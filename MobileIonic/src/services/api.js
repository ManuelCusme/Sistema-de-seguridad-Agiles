import axios from 'axios';

const API_BASE_STORAGE_KEY = 'utaSecurityApiBaseUrl';
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.79.25.95:5000';

export const getApiBaseUrl = () => localStorage.getItem(API_BASE_STORAGE_KEY) || DEFAULT_API_BASE_URL;

export const setApiBaseUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (normalized) {
    localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
  }
  return getApiBaseUrl();
};

export const apiUrl = (path = '') => `${getApiBaseUrl()}/api${path}`;
export const hubUrl = (path = '') => `${getApiBaseUrl()}${path}`;

export const api = axios.create({
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('utaSecurityToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getErrorMessage = (error, fallback = 'No se pudo completar la operacion.') => {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  return data?.error || data?.message || fallback;
};
