import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Text, Surface, Headline, IconButton, Button } from 'react-native-paper';
import * as Location from 'expo-location';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { INCIDENT_CATALOG, INCIDENT_DEFAULT, getIncidentByValue } from '../constants/incidentCatalog';

const DRAWER_WIDTH = 236;

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, token, logout, API_URL } = useAuth();

  const [activeSection, setActiveSection] = useState('alert');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [motivo, setMotivo] = useState(INCIDENT_DEFAULT.value);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const drawerTranslateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const drawerBackdrop = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const myUserId = String(user?.id || user?.Id || '');

  useEffect(() => {
    loadHistory();
  }, []);

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdrop, {
        toValue: 1,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerVisible(false));
  };

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const loadHistory = async () => {
    if (!token) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError('');

    try {
      const response = await axios.get(`${API_URL}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const allIncidents = Array.isArray(response.data) ? response.data : [];
      const filtered = myUserId
        ? allIncidents.filter((item) => String(item.incUsuarioId || '') === myUserId)
        : allIncidents;

      setHistory(filtered);
      setSelectedHistory((current) => {
        if (!current) {
          return filtered[0] || null;
        }

        const updated = filtered.find((item) => item.incId === current.incId);
        return updated || filtered[0] || null;
      });
    } catch (error) {
      console.error('No se pudo cargar el historial:', error.message);
      setHistoryError('No pudimos cargar tu historial en este momento.');
    } finally {
      setHistoryLoading(false);
      setRefreshing(false);
    }
  };

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 3000, useNativeDriver: false }),
    ]).start();

    timerRef.current = setTimeout(sendAlert, 3000);
  };

  const handlePressOut = () => {
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const sendAlert = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const response = await axios.post(
        `${API_URL}/incidents`,
        {
          incLatitud: location.coords.latitude,
          incLongitud: location.coords.longitude,
          incMotivo: motivo,
          incReportadoPor: `${user?.Nombre1} ${user?.Apellido1}`,
          incUsuarioId: user?.id || user?.Id || '',
          incFacultad: user?.Facultad || 'FISEI',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        loadHistory();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      handlePressOut();
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return 'No disponible';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No disponible';
    }

    return date.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (value) => {
    if (!value) {
      return 'No disponible';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No disponible';
    }

    return date.toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAlertView = () => {
    const selectedIncident = getIncidentByValue(motivo);

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionKicker}>BOTÓN DE PÁNICO</Text>
          <Text style={styles.label}>¿Cuál es la emergencia?</Text>
        </View>

        <Surface style={styles.pickerContainer}>
          <Picker
            selectedValue={motivo}
            onValueChange={(itemValue) => setMotivo(itemValue)}
            style={styles.picker}
          >
            {INCIDENT_CATALOG.map((item) => (
              <Picker.Item key={item.value} label={`${item.emoji} ${item.label}`} value={item.value} />
            ))}
          </Picker>
        </Surface>

        <View style={styles.selectedChipRow}>
          <Surface style={[styles.selectedChip, { borderColor: selectedIncident.color }]}>
            <Text style={[styles.selectedChipText, { color: selectedIncident.color }]}>
              {selectedIncident.emoji} {selectedIncident.label}
            </Text>
          </Surface>
        </View>

        <View style={styles.buttonWrapper}>
          <Animated.View
            style={[
              styles.progressCircle,
              {
                height: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                opacity: progressAnim.interpolate({
                  inputRange: [0, 0.1, 1],
                  outputRange: [0, 1, 1],
                }),
              },
            ]}
          />

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.panicButton, success && styles.successButton]}
            >
              <Text style={styles.buttonText}>
                {loading ? 'ENVIANDO...' : success ? '¡ALERTA ENVIADA!' : 'PRESIONAR\n3 SEG'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.hint}>Mantén presionado en caso de peligro real</Text>
      </View>
    );
  };

  const renderHistoryItem = (item) => {
    const incident = getIncidentByValue(item.incMotivo);
    const isSelected = selectedHistory?.incId === item.incId;
    const status = item.incEstado || item.incSeveridad || 'PENDIENTE';

    return (
      <TouchableOpacity
        key={item.incId}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedHistory(item);
          setHistoryModalVisible(true);
        }}
      >
        <Surface style={[styles.historyItem, isSelected && styles.historyItemSelected]}>
          <View style={styles.historyItemTop}>
            <View style={styles.historyItemMain}>
              <Text style={styles.historyItemTitle}>
                {incident.emoji} {incident.label}
              </Text>
              <Text style={styles.historyItemMeta}>
                {formatDate(item.incFechaReporte)} · {formatTime(item.incFechaReporte)}
              </Text>
            </View>
            <Text
              style={[
                styles.statusChip,
                status === 'CERRADO'
                  ? styles.statusClosed
                  : status === 'ASIGNADO'
                    ? styles.statusAssigned
                    : styles.statusPending,
              ]}
            >
              {status}
            </Text>
          </View>

          <Text style={styles.historyItemMeta}>
            Zona: {item.incZona || item.incGeocercaNombre || 'Ubicación desconocida'}
          </Text>
          <Text style={styles.historyItemMeta}>
            Guardia: {item.incCerradoPor || item.incAsignadoPor || 'Sin asignar'}
          </Text>
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderHistoryView = () => {
    const selectedIncident = selectedHistory || history[0] || null;
    const selectedCatalog = selectedIncident ? getIncidentByValue(selectedIncident.incMotivo) : null;

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionKicker}>HISTORIAL</Text>
          <Text style={styles.label}>Tus alertas enviadas</Text>
        </View>

        {historyError ? <Text style={styles.errorText}>{historyError}</Text> : null}

        {historyLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#4d82ff" />
            <Text style={styles.loadingText}>Cargando historial...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aún no tienes alertas registradas</Text>
            <Text style={styles.emptyText}>
              Cuando envíes una alerta desde la pestaña Alertar, aparecerá aquí con su detalle completo.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>{history.map(renderHistoryItem)}</View>
        )}

        {selectedIncident && selectedCatalog ? (
          <Surface style={styles.detailSheet}>
            <Text style={styles.detailTitle}>Detalle rápido</Text>
            <Text style={styles.detailSummary}>
              Toca cualquier alerta para abrir su detalle completo en pantalla.
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Seleccionada</Text>
              <Text style={styles.detailValue}>{selectedCatalog.emoji} {selectedCatalog.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado</Text>
              <Text style={styles.detailValue}>{selectedIncident.incEstado || selectedIncident.incSeveridad || 'PENDIENTE'}</Text>
            </View>
          </Surface>
        ) : null}
      </View>
    );
  };

  const renderHistoryModal = () => {
    if (!selectedHistory) {
      return null;
    }

    const selectedCatalog = getIncidentByValue(selectedHistory.incMotivo);
    const status = selectedHistory.incEstado || selectedHistory.incSeveridad || 'PENDIENTE';

    return (
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalBackdrop}
          onPress={() => setHistoryModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>DETALLE DE ALERTA</Text>
                <Text style={styles.modalTitle}>{selectedCatalog.emoji} {selectedCatalog.label}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHistoryModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalGrid}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Fecha</Text>
                <Text style={styles.modalValue}>{formatDate(selectedHistory.incFechaReporte)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Hora</Text>
                <Text style={styles.modalValue}>{formatTime(selectedHistory.incFechaReporte)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Motivo</Text>
                <Text style={styles.modalValue}>{selectedCatalog.emoji} {selectedCatalog.label}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Estado</Text>
                <Text style={styles.modalValue}>{status}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Guardia</Text>
                <Text style={styles.modalValue}>{selectedHistory.incCerradoPor || selectedHistory.incAsignadoPor || 'Sin asignar'}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Zona</Text>
                <Text style={styles.modalValue}>{selectedHistory.incZona || selectedHistory.incGeocercaNombre || 'Ubicación desconocida'}</Text>
              </View>
            </View>

            <Text style={styles.modalMessage}>
              {selectedHistory.incObservacion
                ? selectedHistory.incObservacion
                : 'Sin observación de cierre todavía.'}
            </Text>

            <Button
              mode="contained"
              onPress={() => setHistoryModalVisible(false)}
              style={styles.modalButton}
            >
              Cerrar detalle
            </Button>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderDrawer = () => {
    if (!drawerVisible) {
      return null;
    }

    return (
      <View style={styles.drawerRoot} pointerEvents="box-none">
        <Animated.View style={[styles.drawerBackdrop, { opacity: drawerBackdrop }]}>
          <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={closeDrawer} />
        </Animated.View>

        <Animated.View style={[styles.drawerPanel, { transform: [{ translateX: drawerTranslateX }] }]}>
          <View style={styles.drawerTopRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>UTA</Text>
            </View>
            <View style={styles.brandTextBlock}>
              <Text style={styles.drawerBrand}>Seguridad UTA</Text>
              <Text style={styles.drawerBrandSub}>Panel del estudiante</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.drawerItem, activeSection === 'alert' && styles.drawerItemActive]}
            onPress={() => {
              setActiveSection('alert');
              closeDrawer();
            }}
          >
            <Text style={styles.drawerIcon}>⚠️</Text>
            <Text style={styles.drawerLabel}>Alertar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.drawerItem, activeSection === 'history' && styles.drawerItemActive]}
            onPress={() => {
              setActiveSection('history');
              closeDrawer();
              loadHistory();
            }}
          >
            <Text style={styles.drawerIcon}>🕘</Text>
            <Text style={styles.drawerLabel}>Historial</Text>
          </TouchableOpacity>

          <View style={styles.drawerHintWrap}>
            <Text style={styles.drawerHint}>
              Este menú se oculta automáticamente al seleccionar una sección.
            </Text>
          </View>

          <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
            <Text style={styles.drawerIcon}>⎋</Text>
            <Text style={styles.drawerLabel}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.workspace}>
        <Surface style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="menu"
              iconColor="white"
              onPress={openDrawer}
              style={styles.headerMenuButton}
            />
            <View>
              <Headline style={styles.userName} numberOfLines={1}>
                {user?.Nombre1} {user?.Apellido1}
              </Headline>
              <Text style={styles.userSub}>{user?.Facultad || 'FISEI'} - {user?.Rol}</Text>
            </View>
          </View>
          <IconButton icon="logout" iconColor="white" onPress={handleLogout} />
        </Surface>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            activeSection === 'history'
              ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadHistory();
                  }}
                />
              )
              : undefined
          }
        >
          {activeSection === 'history' ? renderHistoryView() : renderAlertView()}
        </ScrollView>
      </View>

      {renderDrawer()}
      {renderHistoryModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  workspace: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 18,
    paddingHorizontal: 16,
    backgroundColor: '#0b3354',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  headerMenuButton: {
    margin: 0,
  },
  userName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 22,
    marginBottom: 2,
  },
  userSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 30,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionKicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: '#6b7280',
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    marginBottom: 10,
    color: '#0c1726',
    fontSize: 20,
    fontWeight: '700',
  },
  pickerContainer: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'white',
    elevation: 2,
    overflow: 'hidden',
  },
  picker: {
    height: 60,
    width: '100%',
  },
  selectedChipRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  selectedChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
  },
  selectedChipText: {
    fontWeight: '700',
  },
  buttonWrapper: {
    width: 250,
    height: 250,
    borderRadius: 125,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    marginTop: 10,
    elevation: 10,
  },
  progressCircle: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(77, 130, 255, 0.26)',
  },
  panicButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#4d82ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
  },
  hint: {
    marginTop: 26,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(12,23,38,0.08)',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    padding: 14,
  },
  historyItemSelected: {
    borderColor: 'rgba(77,130,255,0.34)',
    shadowOpacity: 0.12,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  historyItemMain: {
    flex: 1,
    minWidth: 0,
  },
  historyItemTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: '800',
    color: '#0c1726',
  },
  historyItemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  statusChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: '#f7faff',
    color: '#0b3354',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.18)',
  },
  statusAssigned: {
    backgroundColor: '#eef4ff',
    color: '#1d4ed8',
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.18)',
  },
  statusClosed: {
    backgroundColor: '#edfdf3',
    color: '#166534',
    borderWidth: 1,
    borderColor: 'rgba(22,101,52,0.18)',
  },
  detailSheet: {
    marginTop: 8,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.18)',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  detailTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#0c1726',
  },
  detailSummary: {
    marginBottom: 10,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e7edf5',
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  detailValue: {
    color: '#0c1726',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: '#475569',
  },
  emptyState: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.16)',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0c1726',
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
    fontSize: 13,
  },
  errorText: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
  },
  drawerRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,39,64,0.45)',
  },
  drawerBackdropTouch: {
    flex: 1,
  },
  drawerPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#072740',
    paddingTop: 58,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  drawerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4d82ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    flexShrink: 0,
  },
  brandMarkText: {
    color: 'white',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  brandTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  drawerBrand: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  drawerBrandSub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
  },
  drawerItem: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  drawerItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  drawerIcon: {
    color: 'white',
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  drawerLabel: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  drawerHintWrap: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  drawerHint: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
  },
  drawerLogout: {
    marginTop: 'auto',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 39, 64, 0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.18)',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  modalKicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '800',
    color: '#6b7280',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0c1726',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  modalCloseText: {
    color: '#0c1726',
    fontSize: 15,
    fontWeight: '800',
  },
  modalGrid: {
    gap: 6,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e7edf5',
  },
  modalLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  modalValue: {
    color: '#0c1726',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  modalMessage: {
    marginTop: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.18)',
    color: '#0b3354',
    lineHeight: 20,
  },
  modalButton: {
    borderRadius: 14,
    backgroundColor: '#4d82ff',
  },
});

export default HomeScreen;
