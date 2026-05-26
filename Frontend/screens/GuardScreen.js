import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
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

const CAMPUS_CENTER = {
  latitude: -1.2687,
  longitude: -78.6247,
  latitudeDelta: 0.0035,
  longitudeDelta: 0.0035,
};

// Coordenadas de las 4 Zonas UTA Huachi
const ZONES = [
  { 
    id: 'Z1', 
    name: 'Zona 1', 
    color: 'rgba(255, 82, 82, 0.3)',
    coords: [
      { latitude: -1.266416, longitude: -78.625301 },
      { latitude: -1.26648, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.62584 },
    ]
  },
  { 
    id: 'Z2', 
    name: 'Zona 2', 
    color: 'rgba(255, 215, 64, 0.3)',
    coords: [
      { latitude: -1.26648, longitude: -78.624212 },
      { latitude: -1.266555, longitude: -78.622994 },
      { latitude: -1.268564, longitude: -78.62264 },
      { latitude: -1.268564, longitude: -78.624212 },
    ]
  },
  { 
    id: 'Z3', 
    name: 'Zona 3', 
    color: 'rgba(64, 196, 255, 0.3)',
    coords: [
      { latitude: -1.268564, longitude: -78.62584 },
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.27065, longitude: -78.624212 },
      { latitude: -1.270376, longitude: -78.62638 },
    ]
  },
  { 
    id: 'Z4', 
    name: 'Zona 4', 
    color: 'rgba(105, 240, 174, 0.3)',
    coords: [
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.62264 },
      { latitude: -1.270935, longitude: -78.622289 },
      { latitude: -1.27065, longitude: -78.624212 },
    ]
  },
];

const getZoneLabel = (zoneName = '') => {
  const normalized = String(zoneName).toUpperCase();

  if (normalized.includes('INGEN')) return 'Zona 1';
  if (normalized.includes('BIBLI')) return 'Zona 2';
  if (normalized.includes('RECTOR') || normalized.includes('ADMIN')) return 'Zona 3';
  if (normalized.includes('DEPOR')) return 'Zona 4';

  return 'Ubicación desconocida';
};

const getZoneCentroid = (coords = []) => {
  if (!coords.length) {
    return CAMPUS_CENTER;
  }

  const totals = coords.reduce((acc, coord) => {
    acc.latitude += coord.latitude;
    acc.longitude += coord.longitude;
    return acc;
  }, { latitude: 0, longitude: 0 });

  return {
    latitude: totals.latitude / coords.length,
    longitude: totals.longitude / coords.length,
  };
};

const GuardScreen = () => {
  const { logout, user, token, API_URL } = useAuth();
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [loadingIncidents, setLoadingIncidents] = useState({}); // Track loading state per incident
  const [closingIncidents, setClosingIncidents] = useState({}); // Track closing state per incident
  const [closeModalVisible, setCloseModalVisible] = useState(false); // Modal visibility
  const [selectedAlert, setSelectedAlert] = useState(null); // Alert being closed
  const [closeObservation, setCloseObservation] = useState(''); // Observation text input
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('alertas');
  const mapRef = useRef(null);
  const myUserId = String(user?.id || user?.Id || '');

  const activeAlerts = alerts.filter((item) => item.status !== 'CERRADO');
  const historyAlerts = alerts.filter((item) => {
    if (!myUserId) return false;
    return String(item.assignedBy || '') === myUserId || String(item.closedBy || '') === myUserId;
  });
  const visibleAlerts = activeTab === 'historial' ? historyAlerts : activeAlerts;

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const toggleDuty = () => {
    setIsOnDuty((current) => !current);
  };

  const mapIncident = (incidente) => {
    const catalogItem = getIncidentByValue(incidente.incMotivo || 'EMERGENCIA');
    const timestamp = new Date(incidente.incFechaReporte || Date.now()).getTime();
    return {
      id: incidente.incId || Date.now().toString(),
      user: incidente.incReportadoPor || 'Estudiante',
      pos: { lat: incidente.incLatitud, lng: incidente.incLongitud },
      zone: getZoneLabel(incidente.incGeocercaNombre || incidente.incZona),
      geofence: incidente.incGeocercaNombre || incidente.incZona || '',
      motivo: catalogItem.label,
      emoji: catalogItem.emoji,
      motivoKey: catalogItem.value,
      facultad: incidente.incFacultad || 'FISEI',
      time: new Date(incidente.incFechaReporte || Date.now()).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      status: String(incidente.incEstado || incidente.incSeveridad || 'PENDIENTE').toUpperCase(),
      assignedBy: incidente.incAsignadoPor || null,
      assignedAt: incidente.incAsignadoEn || null,
      closedBy: incidente.incCerradoPor || null,
      closedAt: incidente.incCerradoEn || null,
      observation: incidente.incObservacion || '',
      timestamp,
    };
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
            ? { ...a, status: 'ASIGNADO', assignedBy: myUserId || user?.Nombre1 || 'Guardia de turno', assignedAt: new Date().toISOString() }
            : a
        ));
        setSelectedAlertId(alert.id);
        
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
    setCloseObservation('No se encuentra en la Universidad');
    setCloseModalVisible(true);
  };

  const focusAlertOnMap = (alert) => {
    if (!alert?.pos?.lat || !alert?.pos?.lng || !mapRef.current) {
      return;
    }

    setSelectedAlertId(alert.id);
    mapRef.current.animateToRegion(
      {
        latitude: alert.pos.lat,
        longitude: alert.pos.lng,
        latitudeDelta: 0.0045,
        longitudeDelta: 0.0045,
      },
      500
    );
  };

  const recenterMap = () => {
    if (!mapRef.current) {
      return;
    }

    setSelectedAlertId(null);
    mapRef.current.animateToRegion(CAMPUS_CENTER, 500);
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
        setAlerts(prev => prev.map(a => (
          a.id === selectedAlert.id
            ? {
                ...a,
                status: 'CERRADO',
                closedBy: myUserId || user?.Nombre1 || 'Guardia de turno',
                closedAt: new Date().toISOString(),
                observation: closeObservation.trim(),
              }
            : a
        )));
        
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

  useEffect(() => {
    let mounted = true;

    const loadExistingAlerts = async () => {
      try {
        const response = await axios.get(`${API_URL}/incidents`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        const items = Array.isArray(response.data) ? response.data : [];
        const mapped = items
          .map(mapIncident)
          .filter((item) => item.status !== 'CERRADO');

        if (!mounted) return;

        setAlerts((prev) => {
          const merged = [...mapped];
          prev.forEach((alert) => {
            if (!merged.some((item) => item.id === alert.id)) {
              merged.unshift(alert);
            }
          });
          return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });
      } catch (error) {
        console.error('Error cargando alertas iniciales:', error.message);
      }
    };

    loadExistingAlerts();

    return () => {
      mounted = false;
    };
  }, [API_URL, user?.token]);

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
      const zoneName = incidente.incGeocercaNombre || incidente.incZona || '';
      const newAlert = {
        id:       incidente.incId || Date.now().toString(),
        user:     incidente.incReportadoPor || 'Estudiante',
        pos:      { lat: incidente.incLatitud, lng: incidente.incLongitud },
        zone:     getZoneLabel(zoneName),
        geofence: zoneName,
        motivo:   catalogItem.label,
        motivoKey: catalogItem.value,
        facultad: incidente.incFacultad || 'FISEI',
        time:     new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        status:   'PENDIENTE' // Estado inicial
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      Vibration.vibrate([0, 500, 200, 500]);
    });

    newConnection.on("ReceiveIncidentUpdate", (incident) => {
      if (!incident?.incId) return;

      setAlerts((prev) => prev.map((item) => {
        if (item.id !== incident.incId) return item;

        return {
          ...item,
          status: String(incident.incEstado || item.status || 'PENDIENTE').toUpperCase(),
          closedBy: incident.incCerradoPor || item.closedBy || null,
          closedAt: incident.incCerradoEn || item.closedAt || null,
          observation: incident.incObservacion || item.observation || '',
        };
      }));
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
    if (activeTab !== 'alertas') {
      return null;
    }

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
        <View style={styles.headerLeft}>
          <IconButton icon="menu" iconColor="white" onPress={() => setDrawerOpen(true)} />
          <View style={styles.headerTextBlock}>
            <Title style={styles.headerTitle}>UTA Security</Title>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>UTA</Text>
          </View>
        </View>
      </Surface>

      {drawerOpen && (
        <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawerPanel}>
            <Text style={styles.drawerTitle}>Menú</Text>
            <TouchableOpacity style={[styles.drawerItem, activeTab === 'alertas' && styles.drawerItemActive]} onPress={() => { setActiveTab('alertas'); setDrawerOpen(false); }}>
              <Text style={styles.drawerItemText}>🚨 Alertas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, activeTab === 'historial' && styles.drawerItemActive]} onPress={() => { setActiveTab('historial'); setDrawerOpen(false); }}>
              <Text style={styles.drawerItemText}>🕘 Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, activeTab === 'perfil' && styles.drawerItemActive]} onPress={() => { setActiveTab('perfil'); setDrawerOpen(false); }}>
              <Text style={styles.drawerItemText}>👤 Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); handleLogout(); }}>
              <Text style={styles.drawerItemText}>🚪 Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={visibleAlerts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            {activeTab !== 'perfil' ? (
              <>
                <Surface style={styles.heroCard}>
                  <Text style={styles.heroKicker}>{activeTab === 'historial' ? 'HISTORIAL OPERATIVO' : 'CENTRO DE ALERTAS'}</Text>
                  <Text style={styles.heroTitle}>{activeTab === 'historial' ? 'Casos atendidos por ti' : 'Alertas y zonas en tiempo real'}</Text>
                  <Text style={styles.heroSubtitle}>{activeTab === 'historial' ? 'Revisa los incidentes que asumiste o cerraste desde el menú lateral.' : 'Revisa alertas activas, asume casos y navega directamente al punto del incidente.'}</Text>

                  <View style={styles.badgeRow}>
                    <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>📡 En vivo</Text></View>
                    <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>{activeAlerts.length} activas</Text></View>
                    <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>🛡️ Turno {isOnDuty ? 'activo' : 'pausado'}</Text></View>
                  </View>
                </Surface>

                {activeTab === 'alertas' && (
                  <Surface style={styles.mapCard}>
                    <View style={styles.mapCardHeader}>
                      <View>
                        <Text style={styles.sectionKicker}>MAPA TÁCTICO</Text>
                        <Text style={styles.sectionTitle}>Zonas y punto seleccionado</Text>
                      </View>
                    </View>

                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={{
                        ...CAMPUS_CENTER,
                      }}
                      onMapReady={recenterMap}
                      zoomEnabled
                      scrollEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      toolbarEnabled={false}
                    >
                      {ZONES.map(z => (
                        <React.Fragment key={z.id}>
                          <Polygon 
                            coordinates={z.coords}
                            fillColor={z.color}
                            strokeColor="rgba(0,0,0,0.1)"
                            strokeWidth={1}
                          />
                          <Marker coordinate={getZoneCentroid(z.coords)} anchor={{ x: 0.5, y: 0.5 }}>
                            <View style={styles.zoneLabelBubble}>
                              <Text style={styles.zoneLabelText}>{z.name}</Text>
                            </View>
                          </Marker>
                        </React.Fragment>
                      ))}

                      {activeAlerts.map(alert => (
                        <Marker
                          key={alert.id}
                          coordinate={{ latitude: alert.pos.lat, longitude: alert.pos.lng }}
                          title={alert.user}
                          description={`${alert.motivo} - ${alert.zone}`}
                          anchor={{ x: 0.5, y: 0.5 }}
                        >
                          <View style={[styles.incidentEmojiBubble, alert.status === 'ASIGNADO' && styles.incidentEmojiBubbleAssigned]}>
                            <Text style={styles.incidentEmojiText}>{alert.emoji || '🚨'}</Text>
                          </View>
                        </Marker>
                      ))}
                    </MapView>

                    <View style={styles.mapFooter}>
                      <Button mode="outlined" textColor="#2f6bff" style={styles.mapAction} onPress={recenterMap}>Centrar mapa</Button>
                    </View>
                  </Surface>
                )}

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionKicker}>{activeTab === 'historial' ? 'HISTORIAL' : 'ALERTAS RECIENTES'}</Text>
                  <Text style={styles.sectionTitle}>{activeTab === 'historial' ? 'Casos en los que participaste' : 'Casos activos y asignados'}</Text>
                </View>
              </>
            ) : (
              <Surface style={styles.profileCard}>
                <Text style={styles.sectionKicker}>PERFIL DEL GUARDIA</Text>
                <Text style={styles.heroTitle}>{user?.Nombre1} {user?.Apellido1}</Text>
                <Text style={styles.heroSubtitle}>{user?.Rol} · {user?.Facultad || 'UTA'}</Text>
                <View style={styles.profileStatsRow}>
                  <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{activeAlerts.length}</Text><Text style={styles.profileStatLabel}>Alertas activas</Text></View>
                  <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{historyAlerts.length}</Text><Text style={styles.profileStatLabel}>En tu historial</Text></View>
                </View>
                <View style={styles.profileActions}>
                  <TouchableOpacity style={[styles.dutyToggle, isOnDuty ? styles.dutyToggleOn : styles.dutyToggleOff]} onPress={toggleDuty}>
                    <Text style={styles.dutyToggleText}>{isOnDuty ? 'En turno' : 'No en turno'}</Text>
                  </TouchableOpacity>
                  <Button mode="contained" buttonColor="#0b3354" onPress={handleLogout}>Cerrar sesión</Button>
                </View>
              </Surface>
            )}
          </View>
        )}
        ListEmptyComponent={activeTab === 'perfil' ? null : <Text style={styles.emptyText}>{activeTab === 'historial' ? 'No hay acciones tuyas en el historial' : 'No hay alertas activas'}</Text>}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => focusAlertOnMap(item)}>
            <Card style={[
              styles.card,
              item.status === 'ASIGNADO' && styles.cardAsignado,
              selectedAlertId === item.id && styles.cardSelected,
            ]}>
            <Card.Content>
              <View style={styles.cardTopRow}>
                <View style={styles.cardMainBlock}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardEmoji}>{item.emoji || '🚨'}</Text>
                    <Title style={styles.cardTitle}>{item.user}</Title>
                    <Text style={styles.statusBadge(item.status)}>{item.status}</Text>
                  </View>
                  <Paragraph style={styles.cardMeta}>{item.facultad} • {item.zone}</Paragraph>
                  <Paragraph style={styles.cardZone}>Zona: {item.zone}</Paragraph>
                  <Paragraph style={styles.cardTime}>{item.time}</Paragraph>
                  {!!item.observation && activeTab === 'historial' && <Paragraph style={styles.cardObservation}>Observación: {item.observation}</Paragraph>}
                </View>
                <Text style={[styles.motivoBadge, { borderColor: getIncidentByValue(item.motivoKey || item.motivo).color, color: getIncidentByValue(item.motivoKey || item.motivo).color }]}>{item.motivo.toUpperCase()}</Text>
              </View>
            </Card.Content>

            <Card.Actions style={styles.cardActions}>
              {renderIncidentActions(item)}
            </Card.Actions>
            </Card>
          </TouchableOpacity>
        )}
        refreshControl={undefined}
      />

      {/* Modal para cerrar caso con observación */}
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
              <Title style={styles.modalTitle}>Cerrar caso</Title>
              
              {selectedAlert && (
                <Text style={styles.modalAlertInfo}>
                  Incidente: {selectedAlert.user} • {selectedAlert.zone}
                </Text>
              )}

              <View style={styles.quickReasonsRow}>
                <TouchableOpacity style={styles.quickReason} onPress={() => setCloseObservation('No se encuentra en la Universidad')}>
                  <Text style={styles.quickReasonText}>No se encuentra en la Universidad</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickReason} onPress={() => setCloseObservation('Ubicación no confirmada')}>
                  <Text style={styles.quickReasonText}>Ubicación no confirmada</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickReason} onPress={() => setCloseObservation('Sin novedad / falsa alarma')}>
                  <Text style={styles.quickReasonText}>Sin novedad / falsa alarma</Text>
                </TouchableOpacity>
              </View>

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
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: '#0b3354',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 8
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(5, 18, 30, 0.34)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  drawerPanel: {
    width: 240,
    marginTop: 94,
    marginLeft: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#0b3354',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 10,
  },
  drawerTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  drawerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  drawerItemActive: {
    backgroundColor: 'rgba(77,130,255,0.28)',
  },
  drawerItemText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: { 
    color: 'white', 
    fontSize: 18,
    fontWeight: 'bold'
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4d82ff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  brandMarkText: {
    color: 'white',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerContent: {
    gap: 14,
  },
  heroCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.14)',
    elevation: 2,
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#6b7280',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: '#0c1726',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  infoBadge: {
    backgroundColor: '#f3f7ff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  infoBadgeText: {
    color: '#2351c7',
    fontWeight: '700',
    fontSize: 12,
  },
  mapCard: {
    backgroundColor: 'white',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.14)',
    elevation: 2,
  },
  mapCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sectionKicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#6b7280',
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '800',
    color: '#0c1726',
  },
  mapChip: {
    backgroundColor: '#eef4ff',
    color: '#2351c7',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontWeight: '700',
    fontSize: 12,
    overflow: 'hidden',
  },
  map: {
    height: 260,
  },
  mapFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  mapAction: {
    borderRadius: 12,
    minWidth: 120,
  },
  zoneLabelBubble: {
    backgroundColor: 'rgba(11, 51, 84, 0.88)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  zoneLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  incidentEmojiBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D32F2F',
    elevation: 4,
  },
  incidentEmojiBubbleAssigned: {
    borderColor: '#FF9800',
  },
  incidentEmojiText: {
    fontSize: 17,
  },
  cardZone: {
    marginTop: 2,
    color: '#2351c7',
    fontSize: 12,
    fontWeight: '700',
  },
  cardEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  cardObservation: {
    marginTop: 4,
    fontSize: 11,
    color: '#374151',
    fontStyle: 'italic',
  },
  dutyToggle: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  dutyToggleOn: {
    backgroundColor: 'rgba(64, 214, 165, 0.18)',
    borderColor: 'rgba(64, 214, 165, 0.45)',
  },
  dutyToggleOff: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dutyToggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionBlock: {
    marginTop: 4,
    marginBottom: -2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  hero: {
    display: 'none',
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
  cardSelected: {
    borderColor: '#2f6bff',
    borderWidth: 1,
    shadowOpacity: 0.18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardMainBlock: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: 'bold',
    color: '#1B1B1B'
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
    color: '#4b5563',
  },
  cardTime: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
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
  profileCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.14)',
    elevation: 2,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  profileStat: {
    flex: 1,
    backgroundColor: '#f3f7ff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  profileStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b3354',
  },
  profileStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  profileActions: {
    marginTop: 16,
    gap: 10,
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
  quickReasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickReason: {
    backgroundColor: '#eef4ff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.16)',
  },
  quickReasonText: {
    color: '#2351c7',
    fontSize: 12,
    fontWeight: '700',
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
