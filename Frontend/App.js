import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import Constants from 'expo-constants';
import axios from 'axios';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import GuardScreen from './screens/GuardScreen';
import DetalleIncidenteScreen from './screens/DetalleIncidenteScreen';
import { AuthProvider } from './context/AuthContext';

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef();
  const pushWarningShown = useRef(false);

  useEffect(() => {
    const isExpoGo =
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient' ||
      Constants.executionEnvironment === 'browser';

    if (isExpoGo) {
      if (!pushWarningShown.current) {
        console.warn('Expo Go no soporta push remoto en SDK 53+. Usa una development build para notificaciones push.');
        pushWarningShown.current = true;
      }
      return undefined;
    }

    let notificationsModule = null;
    let responseListener = null;

    const setupPush = async () => {
      try {
        const Notifications = require('expo-notifications');
        const Device = require('expo-device');

        notificationsModule = Notifications;

        // Handle notifications when app is in foreground
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const token = await registerForPushNotificationsAsync(Notifications, Device);
        if (token) {
          axios.post('http://localhost:5000/api/notifications/register-token', { token })
            .then(() => console.log('Push Token registrado en backend:', token))
            .catch(err => console.error('Error registrando token', err));
        }

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
      if (notificationsModule && responseListener) {
        notificationsModule.removeNotificationSubscription(responseListener);
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

async function registerForPushNotificationsAsync(Notifications, Device) {
  let token;

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    console.warn('Se omitió el registro de push porque Expo Go ya no soporta este flujo.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
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
      const projectId = "uta-security-sprint2"; // Proyecto expo mock
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.log('Error al obtener push token', e);
    }
  } else {
    // For tests running in simulator/jest
    token = 'mock-push-token-123';
  }

  return token;
}
