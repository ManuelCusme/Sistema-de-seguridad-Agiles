import Constants from 'expo-constants';

const getExpoHost = () => {
  if (process.env.EXPO_PUBLIC_API_HOST) {
    return process.env.EXPO_PUBLIC_API_HOST;
  }

  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.manifest?.debuggerHost,
  ];

  const hostUri = candidates.find(Boolean);

  if (!hostUri) {
    return '192.168.0.5';
  }

  return String(hostUri).split(':')[0];
};

export const API_HOST = getExpoHost();
export const API_BASE_URL = `http://${API_HOST}:5000`;
export const API_URL = `${API_BASE_URL}/api`;
export const ALERTS_HUB_URL = `${API_BASE_URL}/hubs/alerts`;
