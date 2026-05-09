import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Use your local IP instead of localhost for mobile devices
  const API_URL = 'http://10.63.0.110/api';

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true, user: response.data.user };
    } catch (error) {
      return { success: false, message: error.response?.data || 'Error en el login' };
    }
  };

  const register = async (data) => {
    try {
      await axios.post(`${API_URL}/auth/register`, data);
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
