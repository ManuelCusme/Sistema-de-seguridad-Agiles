import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config/network';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión de AsyncStorage al iniciar
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.warn('Error al cargar la sesión:', error.message);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/identity/login`, { usuEmail: email, usuPassword: password });
      const receivedToken = response.data.usuToken;
      const mappedUser = {
        Nombre1:   response.data.usuNombreCompleto?.split(' ')[0] || '',
        Apellido1: response.data.usuNombreCompleto?.split(' ')[1] || '',
        Facultad:  response.data.usuFacultad,
        Rol:       response.data.usuRole,
        rol:       response.data.usuRole, // alias minúscula para el chequeo de rol en LoginScreen
        id:        response.data.usuId,
      };

      // Persistir token y datos del usuario
      await AsyncStorage.setItem('userToken', receivedToken);
      await AsyncStorage.setItem('userData', JSON.stringify(mappedUser));

      setToken(receivedToken);
      setUser(mappedUser);
      return { success: true, user: mappedUser };
    } catch (error) {
      return { success: false, message: error.response?.data || 'Error en el login' };
    }
  };

  const register = async (data) => {
    try {
      // Mapear campos del formulario al formato del backend (prefijo usu)
      await axios.post(`${API_URL}/identity/register`, {
        usuNombre1:   data.nombre1,
        usuNombre2:   data.nombre2,
        usuApellido1: data.apellido1,
        usuApellido2: data.apellido2,
        usuEmail:     data.email,
        usuPassword:  data.password,
        usuBirthDate: data.birthDate,
        usuFacultad:  data.facultad || 'FISEI',
      });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data || 'Error en el registro' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.warn('Error al limpiar la sesión persistente:', error.message);
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
