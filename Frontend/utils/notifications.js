import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const INCIDENT_NOTIFICATION_CHANNEL = 'incidents';

export const ensureLocalNotificationReadyAsync = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(INCIDENT_NOTIFICATION_CHANNEL, {
      name: 'Incidencias UTA',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0b3354',
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleIncidentLocalNotification = async (incident, title = 'Nueva incidencia UTA') => {
  try {
    const canNotify = await ensureLocalNotificationReadyAsync();
    if (!canNotify) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: `${incident?.incMotivo || 'Emergencia'} - ${incident?.incZona || 'zona no disponible'}`,
        sound: 'default',
        data: {
          incidenteId: incident?.incId,
          zona: incident?.incZona || incident?.incGeocercaNombre || 'No disponible',
          tipo: incident?.incMotivo,
          timestamp: incident?.incFechaReporte,
          latitude: incident?.incLatitud || incident?.Latitude || incident?.pos?.lat,
          longitude: incident?.incLongitud || incident?.Longitude || incident?.pos?.lng,
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('No se pudo mostrar notificacion local:', error?.message || error);
  }
};
