import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import axios from 'axios';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import GuardScreen from './screens/GuardScreen';
import DetalleIncidenteScreen from './screens/DetalleIncidenteScreen';
import { AuthProvider } from './context/AuthContext';

// Handle notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        // Enviar token al backend (TA-08.2)
        axios.post('http://localhost:5000/api/notifications/register-token', { token })
          .then(() => console.log('Push Token registrado en backend:', token))
          .catch(err => console.error('Error registrando token', err));
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data && data.incidenteId) {
        // Navegación a DetalleIncidente (TA-08.2)
        navigationRef.current?.navigate('DetalleIncidente', {
          incidenteId: data.incidenteId,
          zona: data.zona,
          tipo: data.tipo,
          timestamp: data.timestamp
        });
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return (
    <AuthProvider>
      <PaperProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registro' }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Seguridad UTA' }} />
            <Stack.Screen name="Guard" component={GuardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DetalleIncidente" component={DetalleIncidenteScreen} options={{ title: 'Detalle de Incidente' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </AuthProvider>
  );
}

async function registerForPushNotificationsAsync() {
  let token;

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
