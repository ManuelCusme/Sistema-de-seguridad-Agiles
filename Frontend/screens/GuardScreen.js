import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  Vibration, 
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { Text, Title, Paragraph, Card, Surface, IconButton, Button } from 'react-native-paper';
import * as signalR from '@microsoft/signalr';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { getIncidentByValue } from '../constants/incidentCatalog';

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
  const { logout, user, API_URL } = useAuth();
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState({}); // Track loading state per incident
  const [closingIncidents, setClosingIncidents] = useState({}); // Track closing state per incident
  const [closeModalVisible, setCloseModalVisible] = useState(false); // Modal visibility
  const [selectedAlert, setSelectedAlert] = useState(null); // Alert being closed
  const [closeObservation, setCloseObservation] = useState(''); // Observation text input
  const mapRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  /**
   * SCRUM-15: Manejar la aceptación de un incidente
   * Al presionar "Aceptar", se marca el incidente como atendido (ASIGNADO)
   */
  const handleAcceptIncident = async (alert) => {
    try {
      // Mostrar estado de carga en el botón
      setLoadingIncidents(prev => ({
        ...prev,
        [alert.id]: true
      }));

      // Petición POST al backend con estructura de DTO esperada
      const response = await axios.post(
        `${API_URL}/incidents/accept`,
        {
          incId: alert.id,
          usuId: user?.id || user?.Id // Soportar ambas variantes de casing
        }
      );

      // Si es exitoso, cambiar el estado del incidente a ASIGNADO
      if (response.status === 200 && response.data.success) {
        setAlerts(prev => prev.map(a => 
          a.id === alert.id 
            ? { ...a, status: 'ASIGNADO' }
            : a
        ));
        
        // Feedback visual: vibración corta de confirmación
        Vibration.vibrate(200);
      }
    } catch (error) {
      console.error('Error al aceptar incidente:', error.message);
    } finally {
      // Remover estado de carga
      setLoadingIncidents(prev => ({
        ...prev,
        [alert.id]: false
      }));
    }
  };

  /**
   * TA-09.2: Abrir modal para cerrar caso
   */
  const handleOpenCloseModal = (alert) => {
    setSelectedAlert(alert);
    setCloseObservation('');
    setCloseModalVisible(true);
  };

  /**
   * TA-09.2: Cerrar modal sin confirmar
   */
  const handleCloseModalCancel = () => {
    setCloseModalVisible(false);
    setSelectedAlert(null);
    setCloseObservation('');
  };

  /**
   * TA-09.2: Confirmar cierre de caso
   * Requiere observación con mínimo 20 caracteres
   */
  const handleConfirmCloseCase = async () => {
    if (!selectedAlert || closeObservation.trim().length < 20) {
      return; // Button should be disabled, but safety check
    }

    try {
      setClosingIncidents(prev => ({
        ...prev,
        [selectedAlert.id]: true
      }));

      // Petición POST al backend para cerrar el incidente
      const response = await axios.post(
        `${API_URL}/incidents/close`,
        {
          incId: selectedAlert.id,
          usuId: user?.id || user?.Id,
          incObservacion: closeObservation.trim()
        }
      );

      // Si es exitoso, eliminar el incidente de la lista
      if (response.status === 200 && response.data.success) {
        setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
        
        // Feedback visual: vibración de confirmación
        Vibration.vibrate([0, 300, 100, 300]);

        // Cerrar modal
        handleCloseModalCancel();
      }
    } catch (error) {
      console.error('Error al cerrar incidente:', error.message);
    } finally {
      setClosingIncidents(prev => ({
        ...prev,
        [selectedAlert.id]: false
      }));
    }
  };

  /**
   * Validar si el botón de confirmar cierre debe estar habilitado
   */
  const isCloseConfirmDisabled = () => {
    return closeObservation.trim().length < 20;
  };

  useEffect(() => {
    let shouldStopAfterStart = false;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("http://192.168.0.5:5000/hubs/alerts")
      .withAutomaticReconnect()
      .build();

    newConnection.on("ReceiveAlert", (incidente) => {
      // El backend envía un objeto IncidentDto con campos: incLatitud, incLongitud,
      // incMotivo, incReportadoPor, incFacultad, incGeocercaNombre, incId, incFechaReporte
      const catalogItem = getIncidentByValue(incidente.incMotivo || 'EMERGENCIA');
      const newAlert = {
        id:       incidente.incId || Date.now().toString(),
        user:     incidente.incReportadoPor || 'Estudiante',
        pos:      { lat: incidente.incLatitud, lng: incidente.incLongitud },
        zone:     incidente.incGeocercaNombre || 'Ubicación desconocida',
        motivo:   catalogItem.label,
        motivoKey: catalogItem.value,
        facultad: incidente.incFacultad || 'FISEI',
        time:     new Date().toLocaleTimeString(),
        status:   'PENDIENTE' // Estado inicial
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      Vibration.vibrate([0, 500, 200, 500]);
    });

    const startPromise = newConnection.start().catch(err => {
      if (!shouldStopAfterStart) {
        console.error(err);
      }
    });

    return () => {
      shouldStopAfterStart = true;
      newConnection.off("ReceiveAlert");
      startPromise.finally(() => {
        if (newConnection.state === signalR.HubConnectionState.Connected) {
          newConnection.stop().catch(() => {});
        }
      });
    };
  }, []);

  /**
   * Renderizar botones según el estado del incidente
   */
  const renderIncidentActions = (alert) => {
    if (alert.status === 'PENDIENTE') {
      return (
        <Button
          mode="contained"
          buttonColor="#FFFFFF"
          textColor="#1B5E20"
          onPress={() => handleAcceptIncident(alert)}
          disabled={loadingIncidents[alert.id]}
          icon={loadingIncidents[alert.id] ? null : "check"}
          style={styles.acceptButton}
          labelStyle={styles.acceptButtonLabel}
        >
          {loadingIncidents[alert.id] ? (
            <View style={styles.buttonBusyRow}>
              <ActivityIndicator 
                size="small" 
                color="#1B5E20" 
                style={{marginRight: 8}}
              />
              <Text style={styles.buttonBusyTextGreen}>Aceptando...</Text>
            </View>
          ) : (
            'Aceptar'
          )}
        </Button>
      );
    } else if (alert.status === 'ASIGNADO') {
      return (
        <Button
          mode="contained"
          buttonColor="#9E9E9E"
          textColor="#FFFFFF"
          onPress={() => handleOpenCloseModal(alert)}
          disabled={closingIncidents[alert.id]}
          icon={closingIncidents[alert.id] ? null : "close"}
          style={styles.closeButton}
          labelStyle={styles.closeButtonLabel}
        >
          {closingIncidents[alert.id] ? (
            <View style={styles.buttonBusyRow}>
              <ActivityIndicator 
                size="small" 
                color="#FFFFFF" 
                style={{marginRight: 8}}
              />
              <Text style={styles.buttonBusyTextWhite}>Cerrando...</Text>
            </View>
          ) : (
            'Cerrar Caso'
          )}
        </Button>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>PANEL DE GUARDIA</Title>
        <IconButton icon="logout" iconColor="white" onPress={handleLogout} />
      </Surface>

      <View style={styles.hero}>
        <Text style={styles.heroKicker}>WAR ROOM UTA</Text>
        <Text style={styles.heroTitle}>Alertas y zonas en tiempo real</Text>
        <Text style={styles.heroSubtitle}>Los motivos, colores y estados siguen el mismo lenguaje del panel admin.</Text>
      </View>

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
            pinColor={alert.status === 'ASIGNADO' ? 'orange' : 'red'}
          />
        ))}
      </MapView>

      <View style={styles.listContainer}>
        <Title style={styles.listTitle}>Alertas Recientes</Title>
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Card style={[styles.card, item.status === 'ASIGNADO' && styles.cardAsignado]}>
              <Card.Content>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <Title style={styles.cardTitle}>{item.user}</Title>
                      <Text style={styles.statusBadge(item.status)}>{item.status}</Text>
                    </View>
                    <Paragraph style={{fontSize: 12, marginTop: 4}}>{item.facultad} • {item.zone}</Paragraph>
                    <Paragraph style={{fontSize: 10, color: '#666', marginTop: 2}}>{item.time}</Paragraph>
                  </View>
                      <Text style={[styles.motivoBadge, { borderColor: getIncidentByValue(item.motivoKey || item.motivo).color, color: getIncidentByValue(item.motivoKey || item.motivo).color }]}>{item.motivo.toUpperCase()}</Text>
                </View>
              </Card.Content>
              
              {/* Card.Actions con botón dinámico según estado */}
              <Card.Actions style={styles.cardActions}>
                {renderIncidentActions(item)}
              </Card.Actions>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay alertas activas</Text>
          }
        />
      </View>

      {/* TA-09.2: Modal para cerrar caso con observación */}
      <Modal
        visible={closeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModalCancel}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex: 1, justifyContent: 'center'}}
          >
            <View style={styles.modalContent}>
              <Title style={styles.modalTitle}>Cerrar Caso</Title>
              
              {selectedAlert && (
                <Text style={styles.modalAlertInfo}>
                  Incidente: {selectedAlert.user} • {selectedAlert.zone}
                </Text>
              )}

              <Text style={styles.modalLabel}>
                Observación del Cierre (mínimo 20 caracteres)
              </Text>
              
              <TextInput
                style={styles.modalTextInput}
                placeholder="Describe el cierre del incidente..."
                placeholderTextColor="#999"
                multiline={true}
                numberOfLines={4}
                value={closeObservation}
                onChangeText={setCloseObservation}
                maxLength={500}
              />

              <Text style={styles.characterCount}>
                {closeObservation.length}/500
              </Text>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={handleCloseModalCancel}
                  style={styles.modalCancelButton}
                  textColor="#666"
                >
                  Cancelar
                </Button>

                <Button
                  mode="contained"
                  buttonColor={isCloseConfirmDisabled() ? '#CCCCCC' : '#D32F2F'}
                  textColor="white"
                  onPress={handleConfirmCloseCase}
                  disabled={isCloseConfirmDisabled() || closingIncidents[selectedAlert?.id]}
                  style={styles.modalConfirmButton}
                  labelStyle={styles.modalConfirmButtonLabel}
                >
                  {closingIncidents[selectedAlert?.id] ? (
                    <View style={styles.buttonBusyRow}>
                      <ActivityIndicator 
                        size="small" 
                        color="white" 
                        style={{marginRight: 8}}
                      />
                      <Text style={styles.buttonBusyTextWhite}>Confirmando...</Text>
                    </View>
                  ) : (
                    'Confirmar Cierre'
                  )}
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f3f6fb'
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4
  },
  headerTitle: { 
    color: 'white', 
    fontSize: 18,
    fontWeight: 'bold'
  },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  heroKicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: '#6b7280',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  map: { 
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden'
  },
  listContainer: {
    height: 250,
    backgroundColor: 'white',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    elevation: 10
  },
  listTitle: { 
    fontSize: 16, 
    marginBottom: 10,
    fontWeight: '600',
    color: '#111827'
  },
  // MEJORAS DE DISEÑO - Tarjetas más atractivas
  card: { 
    marginBottom: 12,
    borderLeftWidth: 5, 
    borderLeftColor: '#D32F2F',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: '#FAFAFA'
  },
  cardAsignado: {
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8F0'
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: 'bold',
    color: '#1B1B1B'
  },
  statusBadge: (status) => ({
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: status === 'PENDIENTE' ? '#FFEBEE' : '#FFF3E0',
    color: status === 'PENDIENTE' ? '#D32F2F' : '#FF6F00'
  }),
  motivoBadge: {
    fontWeight: 'bold', 
    fontSize: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden'
  },
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    justifyContent: 'flex-end'
  },
  acceptButton: {
    borderRadius: 8,
    elevation: 2,
    minHeight: 40,
    justifyContent: 'center'
  },
  acceptButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  closeButton: {
    borderRadius: 8,
    elevation: 2,
    minHeight: 40,
    justifyContent: 'center'
  },
  closeButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  buttonBusyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonBusyTextGreen: {
    color: '#1B5E20',
    fontSize: 12,
    fontWeight: '600'
  },
  buttonBusyTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 20, 
    color: '#999',
    fontSize: 14
  },

  // MODAL STYLES (TA-09.2)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B1B1B',
    marginBottom: 12
  },
  modalAlertInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B1B1B',
    marginBottom: 8
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#1B1B1B',
    textAlignVertical: 'top',
    marginBottom: 8,
    minHeight: 100,
    backgroundColor: '#FAFAFA'
  },
  characterCount: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginBottom: 16
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#D0D0D0'
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 8,
    minHeight: 44
  },
  modalConfirmButtonLabel: {
    fontSize: 13,
    fontWeight: '600'
  }
});

export default GuardScreen;
