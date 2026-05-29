import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import axios from 'axios';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import GuardScreen from './screens/GuardScreen';
import DetalleIncidenteScreen from './screens/DetalleIncidenteScreen';
import { AuthProvider } from './context/AuthContext';
import { API_URL } from './config/network';

const Stack = createStackNavigator();
const BACKGROUND_NOTIFICATION_TASK = 'UTA_SECURITY_BACKGROUND_NOTIFICATION';
const INCIDENT_NOTIFICATION_CHANNEL = 'incidents';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('Error procesando notificacion en background:', error);
    return;
  }

  console.log('Notificacion recibida en background:', data);
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const navigationRef = useRef();
  const pushWarningShown = useRef(false);

  useEffect(() => {
    const isExpoGo =
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient' ||
      Constants.executionEnvironment === 'browser';

    let responseListener = null;
    let foregroundListener = null;

    if (isExpoGo) {
      if (!pushWarningShown.current) {
        console.warn('Expo Go no soporta push remoto en SDK 53+. Usa una development build para notificaciones push.');
        pushWarningShown.current = true;
      }
      return undefined;
    }

    const setupPush = async () => {
      try {
        await registerBackgroundNotificationTask();

        const token = await registerForPushNotificationsAsync();
        if (token) {
          axios.post(`${API_URL}/notifications/register-token`, {
            token,
            platform: Platform.OS,
            role: 'guardia',
          })
            .then(() => console.log('Push Token registrado en backend:', token))
            .catch(err => console.error('Error registrando token', err));
        }

        foregroundListener = Notifications.addNotificationReceivedListener(notification => {
          console.log('Notificacion recibida en foreground:', notification?.request?.content?.data);
        });

        responseListener = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          if (data && data.incidenteId) {
            navigationRef.current?.navigate('DetalleIncidente', {
              incidenteId: data.incidenteId,
              zona: data.zona,
              tipo: data.tipo,
              timestamp: data.timestamp
            });
          }
        });
      } catch (error) {
        console.warn('No se pudo inicializar push notifications en este entorno:', error?.message || error);
      }
    };

    setupPush();

    return () => {
      if (responseListener) {
        Notifications.removeNotificationSubscription(responseListener);
      }

      if (foregroundListener) {
        Notifications.removeNotificationSubscription(foregroundListener);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <PaperProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registro' }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Guard" component={GuardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DetalleIncidente" component={DetalleIncidenteScreen} options={{ title: 'Detalle de Incidente' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </AuthProvider>
  );
}

async function registerBackgroundNotificationTask() {
  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);

  if (!alreadyRegistered) {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    console.warn('Se omitió el registro de push porque Expo Go ya no soporta este flujo.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(INCIDENT_NOTIFICATION_CHANNEL, {
      name: 'Incidencias UTA',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0b3354',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permiso denegado para notificaciones push!');
      return null;
    }
    try {
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      const tokenOptions = projectId ? { projectId } : undefined;
      token = (await Notifications.getExpoPushTokenAsync(tokenOptions)).data;
    } catch (e) {
      console.log('Error al obtener push token', e);
    }
  } else {
    // For tests running in simulator/jest
    token = 'mock-push-token-123';
  }

  return token;
}
