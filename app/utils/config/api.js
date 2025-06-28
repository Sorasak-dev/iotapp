const IP_ADDRESS = '192.168.1.3'; 
const PORT = '3000';

export const API_BASE_URL = `http://${IP_ADDRESS}:${PORT}`;

export const API_ENDPOINTS = {
  // Legacy sensor data endpoint
  SENSOR_DATA: `${API_BASE_URL}/api/user/sensor-data`,
  
  // Device endpoints
  DEVICES: `${API_BASE_URL}/api/devices`,
  DEVICE_TEMPLATES: `${API_BASE_URL}/api/devices/templates`,
  
  // Authentication endpoints
  SIGNIN: `${API_BASE_URL}/api/signin`,
  SIGNUP: `${API_BASE_URL}/api/signup`,
  FORGET_PASSWORD: `${API_BASE_URL}/api/forget-password`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  
  // Notification endpoints
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  ERROR_HISTORY: `${API_BASE_URL}/api/anomaly/history`,
  
  // Zone endpoints
  ZONES: `${API_BASE_URL}/api/zones`
};

export const ANOMALY_ENDPOINTS = {
  HISTORY: `${API_BASE_URL}/api/anomaly/history`,
  DETECT: `${API_BASE_URL}/api/anomaly/detect`,
  STATUS: `${API_BASE_URL}/api/anomaly/status`
};

export const API_TIMEOUT = 10000;

export const DATA_REFRESH_INTERVAL = 3600000; // 1 hour

export const getAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  ANOMALY_ENDPOINTS,
  API_TIMEOUT,
  DATA_REFRESH_INTERVAL,
  getAuthHeaders
};