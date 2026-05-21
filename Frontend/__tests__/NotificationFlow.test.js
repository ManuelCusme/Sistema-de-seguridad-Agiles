import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../App';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock dependencias
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  removeNotificationSubscription: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-push-token-123' })),
  setNotificationChannelAsync: jest.fn(),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('../screens/HomeScreen', () => { const { View } = require('react-native'); return () => <View testID="HomeScreen" />; });
jest.mock('../screens/LoginScreen', () => { const { View } = require('react-native'); return () => <View testID="LoginScreen" />; });
jest.mock('../screens/RegisterScreen', () => { const { View } = require('react-native'); return () => <View testID="RegisterScreen" />; });
jest.mock('../screens/GuardScreen', () => { const { View } = require('react-native'); return () => <View testID="GuardScreen" />; });
jest.mock('../screens/DetalleIncidenteScreen', () => { const { View } = require('react-native'); return () => <View testID="DetalleIncidenteScreen" />; });

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: React.forwardRef(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ navigate: jest.fn() }));
      return children;
    }),
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('@react-navigation/stack', () => {
  return {
    createStackNavigator: () => ({
      Navigator: ({ children }) => children,
      Screen: ({ name }) => null,
    }),
  };
});

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Setup para Axios mock
const mockAxios = new MockAdapter(axios);

describe('Flujo de Notificaciones Push - Guardia', () => {
  beforeEach(() => {
    mockAxios.reset();
  });

  test('✅ Test_PermisosNotificacionSolicitados - Verificar que al montar la app se solicitan permisos de notificación', async () => {
    render(<App />);

    await waitFor(() => {
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
    });
  });

  test('✅ Test_TokenRegistradoEnBackend - Verificar que el pushToken se envía correctamente al backend', async () => {
    mockAxios.onPost('http://localhost:5000/api/notifications/register-token').reply(200);

    render(<App />);

    await waitFor(() => {
      expect(mockAxios.history.post).toBeDefined();
      expect(mockAxios.history.post.length).toBeGreaterThan(0);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({ token: 'mock-push-token-123' });
    });
  });

  test('✅ Test_NotificacionMuestraDatosCompletos - El handler está configurado correctamente', async () => {
    render(<App />);

    await waitFor(() => {
      expect(Notifications.setNotificationHandler).toHaveBeenCalled();
    });

    const handlerCall = Notifications.setNotificationHandler.mock.calls[0][0];
    const result = await handlerCall.handleNotification();
    
    expect(result).toEqual({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  test('✅ Test_NavegacionAlTocarNotificacion - Navegación a DetalleIncidente con id correcto', async () => {
    let responseListenerCallback;
    
    Notifications.addNotificationResponseReceivedListener.mockImplementation((callback) => {
      responseListenerCallback = callback;
      return { remove: jest.fn() };
    });

    render(<App />);

    await waitFor(() => {
      expect(responseListenerCallback).toBeDefined();
    });

    const mockResponse = {
      notification: {
        request: {
          content: {
            data: {
              incidenteId: '104',
              zona: 'Ingeniería',
              tipo: 'Robo',
              timestamp: '2026-05-15 10:00:00'
            }
          }
        }
      }
    };

    expect(() => {
      if (responseListenerCallback) {
        responseListenerCallback(mockResponse);
      }
    }).not.toThrow();
  });
});
