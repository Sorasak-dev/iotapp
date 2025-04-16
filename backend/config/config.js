// config.js
export const API_BASE_URL = 'http://192.168.1.12:3000';
export const API_ENDPOINTS = {
  SENSOR_DATA: '/api/user/sensor-data',
  DEVICES: '/api/devices',
  SIGNIN: '/api/signin',
  SIGNUP: '/api/signup'
};

// How often to refresh sensor data (in ms)
export const DATA_REFRESH_INTERVAL = 3600000; // 1 hour