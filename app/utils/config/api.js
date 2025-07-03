const IP_ADDRESS = '192.168.1.3'; 
const PORT = '3000';

export const API_BASE_URL = `http://${IP_ADDRESS}:${PORT}`;

export const API_ENDPOINTS = {
  // Legacy sensor data endpoint
  SENSOR_DATA: `${API_BASE_URL}/api/user/sensor-data`,
  
  // Device endpoints
  DEVICES: `${API_BASE_URL}/api/devices`,
  DEVICE_TEMPLATES: `${API_BASE_URL}/api/device-templates`,
  
  // Authentication endpoints
  SIGNIN: `${API_BASE_URL}/api/signin`,
  SIGNUP: `${API_BASE_URL}/api/signup`,
  FORGET_PASSWORD: `${API_BASE_URL}/api/forget-password`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  
  // Notification endpoints
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  
  // Zone endpoints
  ZONES: `${API_BASE_URL}/api/zones`
};

// ✨ NEW: Anomaly Detection Endpoints
export const ANOMALY_ENDPOINTS = {
  // Get anomaly history with filters
  HISTORY: `${API_BASE_URL}/api/anomalies`,
  
  // Get anomaly statistics
  STATS: `${API_BASE_URL}/api/anomalies/stats`,
  
  // Manual anomaly check for specific device
  CHECK_DEVICE: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/check-anomalies`,
  
  // Resolve anomaly
  RESOLVE: (anomalyId) => `${API_BASE_URL}/api/anomalies/${anomalyId}/resolve`,
  
  // Health check
  HEALTH: `${API_BASE_URL}/api/anomalies/health`,
  
  // Legacy endpoints (for backward compatibility)
  DETECT: `${API_BASE_URL}/api/anomaly/detect`,
  STATUS: `${API_BASE_URL}/api/anomaly/status`
};

export const API_TIMEOUT = 10000;

export const DATA_REFRESH_INTERVAL = 300000; 

export const getAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

// ✨ NEW: Anomaly API Service
export const AnomalyService = {
  // Get anomaly history with optional filters
  getHistory: async (token, filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${ANOMALY_ENDPOINTS.HISTORY}${queryParams ? `?${queryParams}` : ''}`;
    
    const response = await fetch(url, {
      headers: getAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // Get anomaly statistics
  getStats: async (token, days = 7) => {
    const response = await fetch(`${ANOMALY_ENDPOINTS.STATS}?days=${days}`, {
      headers: getAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // Manual check for specific device
  checkDevice: async (token, deviceId) => {
    const response = await fetch(ANOMALY_ENDPOINTS.CHECK_DEVICE(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // Resolve anomaly
  resolveAnomaly: async (token, anomalyId, notes = '') => {
    const response = await fetch(ANOMALY_ENDPOINTS.RESOLVE(anomalyId), {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ notes })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // Health check
  checkHealth: async () => {
    const response = await fetch(ANOMALY_ENDPOINTS.HEALTH);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  ANOMALY_ENDPOINTS,
  API_TIMEOUT,
  DATA_REFRESH_INTERVAL,
  getAuthHeaders,
  AnomalyService
};