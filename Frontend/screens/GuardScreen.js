import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Vibration } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { Text, Title, Paragraph, Card, Surface, IconButton } from 'react-native-paper';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

// Coordenadas de las 4 Zonas UTA Huachi
const ZONES = [
  { 
    id: 'Z1', 
    name: 'ZONA 1 - INGENIERÍA', 
    color: 'rgba(255, 82, 82, 0.3)',
    coords: [
      { latitude: -1.2690, longitude: -78.6250 },
      { latitude: -1.2690, longitude: -78.6235 },
      { latitude: -1.2710, longitude: -78.6235 },
      { latitude: -1.2710, longitude: -78.6250 },
    ]
  },
  { 
    id: 'Z2', 
    name: 'ZONA 2 - ADMINISTRACIÓN', 
    color: 'rgba(255, 215, 64, 0.3)',
    coords: [
      { latitude: -1.2690, longitude: -78.6235 },
      { latitude: -1.2690, longitude: -78.6210 },
      { latitude: -1.2710, longitude: -78.6210 },
      { latitude: -1.2710, longitude: -78.6235 },
    ]
  },
  { 
    id: 'Z3', 
    name: 'ZONA 3 - DEPORTES', 
    color: 'rgba(64, 196, 255, 0.3)',
    coords: [
      { latitude: -1.2670, longitude: -78.6250 },
      { latitude: -1.2670, longitude: -78.6235 },
      { latitude: -1.2690, longitude: -78.6235 },
      { latitude: -1.2690, longitude: -78.6250 },
    ]
  },
  { 
    id: 'Z4', 
    name: 'ZONA 4 - IDIOMAS', 
    color: 'rgba(105, 240, 174, 0.3)',
    coords: [
      { latitude: -1.2670, longitude: -78.6235 },
      { latitude: -1.2670, longitude: -78.6210 },
      { latitude: -1.2690, longitude: -78.6210 },
      { latitude: -1.2690, longitude: -78.6235 },
    ]
  },
];

const GuardScreen = () => {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const mapRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("http://192.168.0.5:5000/hubs/alerts")
      .withAutomaticReconnect()
      .build();

    newConnection.on("ReceiveAlert", (incidente) => {
      // El backend envía un objeto IncidentDto con campos: incLatitud, incLongitud,
      // incMotivo, incReportadoPor, incFacultad, incGeocercaNombre, incId, incFechaReporte
      const newAlert = {
        id:       incidente.incId || Date.now().toString(),
        user:     incidente.incReportadoPor || 'Estudiante',
        pos:      { lat: incidente.incLatitud, lng: incidente.incLongitud },
        zone:     incidente.incGeocercaNombre || 'Ubicación desconocida',
        motivo:   incidente.incMotivo || 'Emergencia',
        facultad: incidente.incFacultad || 'FISEI',
        time:     new Date().toLocaleTimeString()
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      Vibration.vibrate([0, 500, 200, 500]);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude:      incidente.incLatitud,
          longitude:     incidente.incLongitud,
          latitudeDelta:  0.005,
          longitudeDelta: 0.005,
        }, 1000);
      }
    });

    newConnection.start().catch(err => console.error(err));
    return () => newConnection.stop();
  }, []);

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>PANEL DE GUARDIA</Title>
        <IconButton icon="logout" iconColor="white" onPress={handleLogout} />
      </Surface>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: -1.2687,
          longitude: -78.6247,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Dibujo de Polígonos de Zonas */}
        {ZONES.map(z => (
          <Polygon 
            key={z.id}
            coordinates={z.coords}
            fillColor={z.color}
            strokeColor="rgba(0,0,0,0.1)"
            strokeWidth={1}
          />
        ))}

        {alerts.map(alert => (
          <Marker
            key={alert.id}
            coordinate={{ latitude: alert.pos.lat, longitude: alert.pos.lng }}
            title={alert.user}
            description={`${alert.motivo} - ${alert.zone}`}
            pinColor="red"
          />
        ))}
      </MapView>

      <View style={styles.listContainer}>
        <Title style={styles.listTitle}>Alertas Recientes</Title>
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Title style={styles.cardTitle}>{item.user}</Title>
                  <Text style={{color: '#D32F2F', fontWeight: 'bold', fontSize: 12}}>{item.motivo.toUpperCase()}</Text>
                </View>
                <Paragraph style={{fontSize: 12}}>{item.facultad} • {item.zone}</Paragraph>
                <Paragraph style={{fontSize: 10, color: '#666'}}>{item.time}</Paragraph>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay alertas activas</Text>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#1B5E20',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4
  },
  headerTitle: { color: 'white', fontSize: 18 },
  map: { flex: 1 },
  listContainer: {
    height: 250,
    backgroundColor: 'white',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    elevation: 10
  },
  listTitle: { fontSize: 16, marginBottom: 10 },
  card: { marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#D32F2F' },
  cardTitle: { fontSize: 14, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#999' }
});

export default GuardScreen;
