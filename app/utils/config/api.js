const IP_ADDRESS = '192.168.1.11';
const PORT = '3000';

export const API_BASE_URL = `http://${IP_ADDRESS}:${PORT}`;

export const API_ENDPOINTS = {
  SENSOR_DATA: `${API_BASE_URL}/api/user/sensor-data`,
  DEVICES: `${API_BASE_URL}/api/devices`,
  DEVICE_TEMPLATES: `${API_BASE_URL}/api/device-templates`,
  USERS: `${API_BASE_URL}/api/users`,
  SIGNIN: `${API_BASE_URL}/api/signin`,
  SIGNUP: `${API_BASE_URL}/api/signup`,
  FORGET_PASSWORD: `${API_BASE_URL}/api/forget-password`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  ZONES: `${API_BASE_URL}/api/zones`
};

export const ANOMALY_ENDPOINTS = {
  DETECT: `${API_BASE_URL}/api/anomalies/detect`,            
  HISTORY: `${API_BASE_URL}/api/anomalies`,            
  STATS: `${API_BASE_URL}/api/anomalies/stats`,             
  CHECK_DEVICE: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/check-anomalies`, 
  RESOLVE: (anomalyId) => `${API_BASE_URL}/api/anomalies/${anomalyId}/resolve`,         
  BATCH_RESOLVE: `${API_BASE_URL}/api/anomalies/batch-resolve`, 
  HEALTH: `${API_BASE_URL}/api/anomalies/health`,              
  TYPES: `${API_BASE_URL}/api/anomalies/types`,               
  RECEIVE_ALERT: `${API_BASE_URL}/api/anomalies`            
};

export const API_TIMEOUT = 10000;

export const DATA_REFRESH_INTERVAL = 300000; 

export const getAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

export const PushNotificationService = {
  registerToken: async (token, userId, pushToken, deviceInfo) => {
    try {
      console.log('Registering push token...', { userId, deviceInfo });
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/register-token`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          userId,
          token: pushToken,
          deviceInfo,
        }),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Push token registered successfully:', result);
      return result;
      
    } catch (error) {
      console.error('Error registering push token:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to register push token' 
      };
    }
  },

  getPreferences: async (token) => {
    try {
      console.log('Getting notification preferences...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/preferences`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No preferences found, needs registration');
          return { 
            success: false, 
            needsRegistration: true,
            error: 'No preferences found' 
          };
        }
        
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Preferences loaded:', result);
      return result;
      
    } catch (error) {
      console.error('Error getting preferences:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get preferences',
        needsRegistration: true
      };
    }
  },

  updatePreferences: async (token, preferences) => {
    try {
      console.log('Updating notification preferences...', preferences);
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(preferences),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('User not found, needs token registration');
          return { 
            success: false, 
            needsRegistration: true,
            error: 'User not found - needs token registration' 
          };
        }
        
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Preferences updated successfully:', result);
      return result;
      
    } catch (error) {
      console.error('Error updating preferences:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update preferences' 
      };
    }
  },

  sendTestNotification: async (token) => {
    try {
      console.log('Sending test notification...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/test`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          title: 'Test Notification',
          message: 'This is a test notification from EMIB app',
          data: { type: 'test' }
        }),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Test notification sent:', result);
      return result;
      
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send test notification' 
      };
    }
  },

  getHistory: async (token, limit = 50) => {
    try {
      console.log('Getting notification history...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/history?limit=${limit}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Notification history loaded:', result);
      return result;
      
    } catch (error) {
      console.error('Error getting notification history:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get notification history',
        data: { notifications: [] }
      };
    }
  },

  getDeliveryStats: async (token, days = 7) => {
    try {
      console.log(`Getting delivery stats for ${days} days...`);
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/stats?days=${days}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Delivery stats loaded:', result);
      return result;
      
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get delivery stats',
        data: { 
          total_sent: 0, 
          total_delivered: 0, 
          delivery_rate: 0 
        }
      };
    }
  },

  checkHealth: async () => {
    try {
      console.log('Checking notification service health...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Notification service health:', result);
      return result;
      
    } catch (error) {
      console.error('Notification health check failed:', error);
      return { 
        success: false, 
        error: error.message || 'Health check failed',
        data: { 
          status: 'offline',
          push_service: 'unavailable'
        }
      };
    }
  }
};

export const AnomalyService = {
  /**
   * @param {string} token 
   * @param {Object} sensorData 
   * @returns {Promise<Object>} 
   */
  detectAnomaly: async (token, sensorData) => {
    try {
      console.log('Real-time anomaly detection (Hybrid: Gradient Boosting + Rules)');
      console.log('Sensor data:', sensorData);
      
      const response = await fetch(ANOMALY_ENDPOINTS.DETECT, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(sensorData),
        timeout: 30000 
      });
      
      if (!response.ok) {
        if (response.status === 408) {
          throw new Error('Detection timeout - please try again');
        }
        
        if (response.status === 503) {
          throw new Error('Anomaly detection service temporarily unavailable');
        }
        
        if (response.status === 429) {
          throw new Error('Too many requests - please wait a moment');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Detection result:', result);
      
      /**
       * Response format:
       * {
       *   success: true,
       *   alert_level: "green"|"yellow"|"red",
       *   health_score: 0-100,
       *   message: "...",
       *   is_anomaly: true|false,
       *   details: {
       *     rule_based_detection: [...],
       *     ml_detection: [...],
       *     summary: {...},
       *     recommendations: [...]
       *   },
       *   metadata: {
       *     model_used: "gradient_boosting",
       *     detection_method: "hybrid",
       *     processing_time: 0.05
       *   }
       * }
       */
      
      return {
        success: true,
        ...result
      };
      
    } catch (error) {
      console.error('Detection error:', error);
      return {
        success: false,
        message: error.message || 'Detection failed',
        alert_level: 'green',
        health_score: 100,
        is_anomaly: false,
        error: error.message
      };
    }
  },

  getHistory: async (token, filters = {}) => {
    try {
      console.log('Fetching anomaly history with filters:', filters);
      
      const queryParams = new URLSearchParams();
      
      if (filters.device_id) queryParams.append('deviceId', filters.device_id);
      if (filters.status === 'unresolved') queryParams.append('resolved', 'false');
      if (filters.status === 'resolved') queryParams.append('resolved', 'true');
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.alertLevel) queryParams.append('alertLevel', filters.alertLevel);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const url = `${ANOMALY_ENDPOINTS.HISTORY}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: true,
            data: {
              anomalies: [],
              pagination: {
                page: 1,
                limit: parseInt(filters.limit) || 20,
                total: 0,
                pages: 0,
                hasNext: false,
                hasPrev: false
              }
            }
          };
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Anomaly history loaded:', result);
      return result;
      
    } catch (error) {
      console.error('Error fetching anomaly history:', error);
      return {
        success: true,
        data: {
          anomalies: [],
          pagination: {
            page: 1,
            limit: parseInt(filters.limit) || 20,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false
          }
        },
        error: error.message
      };
    }
  },

  getStats: async (token, days = 7) => {
    try {
      console.log(`Fetching anomaly stats for ${days} days`);
      
      const url = `${ANOMALY_ENDPOINTS.STATS}?days=${days}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: true,
            data: {
              total_anomalies: 0,
              resolved_count: 0,
              unresolved_count: 0,
              resolution_rate: 0,
              avg_resolution_time_hours: 0,
              period: `${days} days`,
              generated_at: new Date().toISOString()
            }
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Stats loaded:', result);
      return result;
      
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        success: true,
        data: {
          total_anomalies: 0,
          resolved_count: 0,
          unresolved_count: 0,
          resolution_rate: 0,
          avg_resolution_time_hours: 0,
          period: `${days} days`,
          generated_at: new Date().toISOString()
        }
      };
    }
  },

  checkDevice: async (token, deviceId) => {
    try {
      console.log(`Manual device check for ${deviceId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.CHECK_DEVICE(deviceId), {
        method: 'POST',
        headers: getAuthHeaders(token),
        timeout: 30000
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded - please wait before trying again');
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Device check result:', result);
      return result;
      
    } catch (error) {
      console.error('Error in device check:', error);
      return {
        success: false,
        message: error.message || 'Device check failed'
      };
    }
  },

  resolveAnomaly: async (token, anomalyId, notes = '') => {
    try {
      console.log(`Resolving anomaly ${anomalyId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.RESOLVE(anomalyId), {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ notes }),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Anomaly resolved:', result);
      return result;
      
    } catch (error) {
      console.error('Error resolving anomaly:', error);
      return {
        success: false,
        message: error.message || 'Failed to resolve anomaly'
      };
    }
  },

  batchResolve: async (token, anomalyIds, notes = '') => {
    try {
      console.log(`Batch resolving ${anomalyIds.length} anomalies`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.BATCH_RESOLVE, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ 
          anomalyIds, 
          notes: notes || 'Batch resolved'
        }),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Batch resolve completed:', result);
      return result;
      
    } catch (error) {
      console.error('Error in batch resolve:', error);
      return {
        success: false,
        message: error.message || 'Batch resolve failed'
      };
    }
  },

  checkHealth: async () => {
    try {
      console.log('Checking anomaly service health');
      
      const response = await fetch(ANOMALY_ENDPOINTS.HEALTH, {
        timeout: 5000
      });
      
      if (!response.ok) {
        return {
          success: true,
          data: {
            status: 'degraded',
            model_ready: false
          }
        };
      }
      
      const result = await response.json();
      console.log('Health check result:', result);
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: true,
        data: {
          status: 'offline',
          model_ready: false,
          error: error.message
        }
      };
    }
  },

  getTypes: async () => {
    try {
      const response = await fetch(ANOMALY_ENDPOINTS.TYPES, {
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Error fetching anomaly types:', error);
      return {
        success: true,
        data: {
          rule_based: {},
          ml_based: {}
        }
      };
    }
  }
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  ANOMALY_ENDPOINTS,
  API_TIMEOUT,
  DATA_REFRESH_INTERVAL,
  getAuthHeaders,
  AnomalyService,
  PushNotificationService  
};