import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, Title, Surface, Card, Paragraph, Button } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getWalkwayRoute, CAMPUS_CENTER } from '../utils/routing';

const DetalleIncidenteScreen = ({ route, navigation }) => {
  const incidenteId = route.params?.incidenteId || 'Desconocido';
  const zona = route.params?.zona || 'No disponible';
  const tipo = route.params?.tipo || 'Emergencia';
  const timestamp = route.params?.timestamp || new Date().toLocaleString();
  const latitude = route.params?.latitude ? Number(route.params.latitude) : null;
  const longitude = route.params?.longitude ? Number(route.params.longitude) : null;

  const [currentLocation, setCurrentLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (!latitude || !longitude) {
        return; // No map coordinates provided
      }

      setLoadingLocation(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setPermissionGranted(true);
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } else {
          Alert.alert(
            'Ubicación requerida',
            'Se requiere permiso de ubicación para mostrar la ruta guiada hacia el incidente.'
          );
        }
      } catch (error) {
        console.warn('Error obteniendo ubicación para detalle:', error);
      } finally {
        setLoadingLocation(false);
      }
    };

    requestLocationPermission();
  }, [latitude, longitude]);

  const recenterMap = () => {
    if (!mapRef.current) return;

    const coords = [];
    if (latitude && longitude) {
      coords.push({ latitude, longitude });
    }
    if (currentLocation) {
      coords.push(currentLocation);
    }

    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 50, bottom: 250, left: 50 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (currentLocation && latitude && longitude) {
      // Auto-focus when locations are loaded
      setTimeout(recenterMap, 600);
    }
  }, [currentLocation, latitude, longitude]);

  const hasMapCoordinates = latitude !== null && longitude !== null;

  return (
    <View style={styles.container}>
      {hasMapCoordinates ? (
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: latitude || CAMPUS_CENTER.latitude,
              longitude: longitude || CAMPUS_CENTER.longitude,
              latitudeDelta: 0.0035,
              longitudeDelta: 0.0035,
            }}
          >
            {/* Marcador del incidente */}
            <Marker
              coordinate={{ latitude, longitude }}
              title={tipo.toUpperCase()}
              description={`Zona: ${zona}`}
              pinColor="#ef4444"
            />

            {/* Marcador de la ubicación actual del usuario */}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Tu Ubicación"
                pinColor="#4d82ff"
              />
            )}

            {/* Ruta peatonal guiada */}
            {currentLocation && (
              <Polyline
                coordinates={getWalkwayRoute(currentLocation, { latitude, longitude })}
                strokeColor="#4d82ff"
                strokeWidth={4}
              />
            )}
          </MapView>

          {/* Botón flotante para recentrar mapa */}
          <TouchableOpacity style={styles.recenterButton} onPress={recenterMap}>
            <Text style={styles.recenterButtonText}>🎯 Centrar Mapa</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noMapWrapper}>
          <Text style={styles.noMapText}>📍 Mapa no disponible para esta alerta</Text>
        </View>
      )}

      {/* Tarjeta flotante de detalles en la parte inferior */}
      <Card style={[styles.card, hasMapCoordinates && styles.floatingCard]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.accentBar} />
          
          <View style={styles.row}>
            <View style={styles.mainInfo}>
              <Text style={styles.kicker}>TIPO DE EMERGENCIA</Text>
              <Text style={styles.alertTitle}>{tipo.toUpperCase()}</Text>
            </View>
            {loadingLocation && <ActivityIndicator color="#4d82ff" size="small" />}
          </View>

          <View style={styles.grid}>
            <View style={styles.gridCol}>
              <Text style={styles.label}>ZONA DETECTADA</Text>
              <Text style={styles.value}>{zona}</Text>
            </View>

            <View style={styles.gridCol}>
              <Text style={styles.label}>HORA REPORTADA</Text>
              <Text style={styles.value}>{timestamp}</Text>
            </View>
          </View>

          {hasMapCoordinates && !currentLocation && !loadingLocation && (
            <Button
              mode="contained"
              onPress={async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                  const position = await Location.getCurrentPositionAsync({});
                  setCurrentLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  });
                }
              }}
              style={styles.actionButton}
            >
              Calcular Ruta Peatonal
            </Button>
          )}

          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            labelStyle={styles.backButtonLabel}
          >
            Volver a la app
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  noMapWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noMapText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },
  recenterButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  recenterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  card: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: 'white',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floatingCard: {
    position: 'absolute',
    bottom: 16,
    left: 8,
    right: 8,
    margin: 8,
    borderRadius: 22,
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardContent: {
    paddingTop: 8,
    gap: 12,
  },
  accentBar: {
    width: 40,
    height: 5,
    backgroundColor: '#cbd5e1',
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainInfo: {
    flex: 1,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ef4444',
  },
  grid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 10,
    gap: 16,
  },
  gridCol: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  actionButton: {
    borderRadius: 12,
    backgroundColor: '#4d82ff',
    paddingVertical: 2,
  },
  backButton: {
    borderRadius: 12,
    borderColor: '#e2e8f0',
  },
  backButtonLabel: {
    color: '#64748b',
    fontWeight: '700',
  },
});

export default DetalleIncidenteScreen;
