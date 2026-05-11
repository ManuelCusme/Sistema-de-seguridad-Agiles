import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Use your local IP instead of localhost for mobile devices
  const API_URL = 'http://10.79.20.112:5000/api';

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/identity/login`, { usuEmail: email, usuPassword: password });
      setToken(response.data.usuToken);
      // Mapear campos del backend (prefijo usu) a los usados por el Frontend
      const user = {
        Nombre1:   response.data.usuNombreCompleto?.split(' ')[0] || '',
        Apellido1: response.data.usuNombreCompleto?.split(' ')[1] || '',
        Facultad:  response.data.usuFacultad,
        Rol:       response.data.usuRole,
        rol:       response.data.usuRole, // alias minúscula para el chequeo de rol en LoginScreen
        id:        response.data.usuId,
      };
      setUser(user);
      return { success: true, user };
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

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
