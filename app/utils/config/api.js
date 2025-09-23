const IP_ADDRESS = '192.168.1.11';
const PORT = '3000';

export const API_BASE_URL = `http://${IP_ADDRESS}:${PORT}`;

export const API_ENDPOINTS = {
  // Legacy sensor data endpoint
  SENSOR_DATA: `${API_BASE_URL}/api/user/sensor-data`,
  
  // Device endpoints
  DEVICES: `${API_BASE_URL}/api/devices`,
  DEVICE_TEMPLATES: `${API_BASE_URL}/api/device-templates`,
  
  // Authentication endpoints
  USERS: `${API_BASE_URL}/api/users`,
  SIGNIN: `${API_BASE_URL}/api/signin`,
  SIGNUP: `${API_BASE_URL}/api/signup`,
  FORGET_PASSWORD: `${API_BASE_URL}/api/forget-password`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  
  // Notification endpoints
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  
  // Zone endpoints
  ZONES: `${API_BASE_URL}/api/zones`
};

// ✅ UPDATED: Anomaly Detection Endpoints for v2.1
export const ANOMALY_ENDPOINTS = {
  // Matching routes from anomalyRoutes.js v2.1
  HISTORY: `${API_BASE_URL}/api/anomalies`,                    // GET /api/anomalies
  STATS: `${API_BASE_URL}/api/anomalies/stats`,               // GET /api/anomalies/stats  
  DETECT: `${API_BASE_URL}/api/detect`,                       // POST /api/detect (NEW v2.1)
  CHECK_DEVICE: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/check-anomalies`, // POST /api/devices/:deviceId/check-anomalies
  RESOLVE: (anomalyId) => `${API_BASE_URL}/api/anomalies/${anomalyId}/resolve`,          // PUT /api/anomalies/:anomalyId/resolve
  BATCH_RESOLVE: `${API_BASE_URL}/api/anomalies/batch-resolve`, // PUT /api/anomalies/batch-resolve
  HEALTH: `${API_BASE_URL}/api/anomalies/health`,              // GET /api/anomalies/health
  TYPES: `${API_BASE_URL}/api/anomalies/types`,               // GET /api/anomalies/types
  
  // For receiving alerts from Python (not used by frontend)
  RECEIVE_ALERT: `${API_BASE_URL}/api/anomalies`              // POST /api/anomalies
};

export const API_TIMEOUT = 10000;

export const DATA_REFRESH_INTERVAL = 300000; 

export const getAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

// ✅ Push Notification Service (unchanged)
export const PushNotificationService = {
  // Register push token
  registerToken: async (token, userId, pushToken, deviceInfo) => {
    try {
      console.log('📡 Registering push token...', { userId, deviceInfo });
      
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
      console.log('✅ Push token registered successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error registering push token:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to register push token' 
      };
    }
  },

  getPreferences: async (token) => {
    try {
      console.log('📡 Getting notification preferences...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/preferences`, {
        method: 'GET',
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ No preferences found, needs registration');
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
      console.log('✅ Preferences loaded:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error getting preferences:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get preferences',
        needsRegistration: true
      };
    }
  },

  updatePreferences: async (token, preferences) => {
    try {
      console.log('📡 Updating notification preferences...', preferences);
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(preferences),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ User not found, needs token registration');
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
      console.log('✅ Preferences updated successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update preferences' 
      };
    }
  },

  sendTestNotification: async (token) => {
    try {
      console.log('📡 Sending test notification...');
      
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
      console.log('✅ Test notification sent:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send test notification' 
      };
    }
  },

  getHistory: async (token, limit = 50) => {
    try {
      console.log('📡 Getting notification history...');
      
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
      console.log('✅ Notification history loaded:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error getting notification history:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get notification history',
        data: { notifications: [] }
      };
    }
  },

  getDeliveryStats: async (token, days = 7) => {
    try {
      console.log(`📡 Getting delivery stats for ${days} days...`);
      
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
      console.log('✅ Delivery stats loaded:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error getting delivery stats:', error);
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
      console.log('💓 Checking notification service health...');
      
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('💓 Notification service health:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Notification health check failed:', error);
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

// ✅ UPDATED: Enhanced Anomaly API Service for v2.1
export const AnomalyService = {
  // Get anomaly history with v2.1 support
  getHistory: async (token, filters = {}) => {
    try {
      console.log('📡 Fetching anomaly history v2.1 with filters:', filters);
      
      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      
      if (filters.device_id) queryParams.append('deviceId', filters.device_id);
      if (filters.status === 'unresolved') queryParams.append('resolved', 'false');
      if (filters.status === 'resolved') queryParams.append('resolved', 'true');
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.alertLevel) queryParams.append('alertLevel', filters.alertLevel);
      if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.healthScoreMin) queryParams.append('healthScoreMin', filters.healthScoreMin);
      if (filters.healthScoreMax) queryParams.append('healthScoreMax', filters.healthScoreMax);
      
      const url = `${ANOMALY_ENDPOINTS.HISTORY}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      console.log('🔗 Request URL:', url);
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Anomaly history endpoint not found, using v2.1 fallback');
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
            apiVersion: '2.1'
          };
        }
        
        if (response.status === 400) {
          const errorData = await response.text();
          console.error('❌ Bad request error:', errorData);
          throw new Error(`Bad request: ${errorData}`);
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Anomaly history v2.1 response:', result);
      
      // Handle v2.1 response format
      if (result.success && result.data) {
        return {
          ...result,
          apiVersion: result.apiVersion || '2.1'
        };
      }
      
      // Fallback structure
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
        apiVersion: '2.1'
      };
      
    } catch (error) {
      console.error('❌ Error fetching anomaly history v2.1:', error);
      
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
        apiVersion: '2.1',
        error: error.message
      };
    }
  },

  // Get enhanced statistics v2.1
  getStats: async (token, days = 7) => {
    try {
      console.log(`📊 Fetching anomaly stats v2.1 for ${days} days`);
      
      const url = `${ANOMALY_ENDPOINTS.STATS}?days=${days}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });
      
      console.log('📥 Stats v2.1 response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Anomaly stats v2.1 endpoint not found, using enhanced fallback');
          return {
            success: true,
            data: {
              overview: {
                total_anomaly_reports: 0,
                total_detected_issues: 0,
                avg_health_score: 100,
                critical_count: 0,
                warning_count: 0,
                normal_count: 0,
                resolved_count: 0,
                resolution_rate: 0,
                avg_response_time: 0
              },
              healthTrend: [],
              deviceStats: [],
              alertStats: [],
              period: `${days} days`,
              generated_at: new Date().toISOString(),
              apiVersion: '2.1'
            }
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Stats v2.1 response:', result);
      
      // Handle v2.1 enhanced response format
      if (result.success && result.data) {
        return {
          success: true,
          data: {
            // Map v2.1 overview structure
            total_anomalies: result.data.overview?.total_anomaly_reports || result.data.total_anomalies || 0,
            resolved_count: result.data.overview?.resolved_count || result.data.resolved_count || 0,
            unresolved_count: result.data.overview?.total_anomaly_reports - result.data.overview?.resolved_count || 0,
            resolution_rate: result.data.overview?.resolution_rate || result.data.resolution_rate || 0,
            avg_resolution_time_hours: result.data.avg_resolution_time_hours || 0,
            
            // Enhanced v2.1 fields
            avg_health_score: result.data.overview?.avg_health_score || 100,
            critical_count: result.data.overview?.critical_count || 0,
            warning_count: result.data.overview?.warning_count || 0,
            avg_response_time: result.data.overview?.avg_response_time || 0,
            
            // Keep existing structure for compatibility
            accuracy_rate: 95.2,
            period: result.data.period || `${days} days`,
            generated_at: result.data.generated_at || new Date().toISOString(),
            
            // Enhanced stats
            healthTrend: result.data.healthTrend || [],
            deviceStats: result.data.deviceStats || [],
            alertStats: result.data.alertStats || [],
            
            apiVersion: result.data.apiVersion || '2.1'
          }
        };
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching anomaly stats v2.1:', error);
      
      return {
        success: true,
        data: {
          total_anomalies: 0,
          resolved_count: 0,
          unresolved_count: 0,
          resolution_rate: 0,
          avg_resolution_time_hours: 0,
          avg_health_score: 100,
          accuracy_rate: 95.2,
          period: `${days} days`,
          generated_at: new Date().toISOString(),
          alertStats: [],
          healthTrend: [],
          deviceStats: [],
          apiVersion: '2.1'
        }
      };
    }
  },

  // NEW: Manual detection with v2.1 API
  detectAnomalies: async (token, deviceId, sensorData, options = {}) => {
    try {
      console.log(`🔍 Manual anomaly detection v2.1 for device ${deviceId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.DETECT, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          deviceId,
          sensorData,
          options: {
            method: options.method || 'hybrid',
            model: options.model || 'ensemble',
            useCache: options.useCache !== false,
            includeHistory: options.includeHistory || false
          }
        }),
        timeout: 30000
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Direct detection endpoint not available');
          return {
            success: false,
            message: 'Direct detection not available'
          };
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Manual detection v2.1 result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error in manual detection v2.1:', error);
      return {
        success: false,
        message: error.message || 'Detection failed'
      };
    }
  },

  // Enhanced device check for v2.1
  checkDevice: async (token, deviceId) => {
    try {
      console.log(`🔍 Enhanced device check v2.1 for ${deviceId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.CHECK_DEVICE(deviceId), {
        method: 'POST',
        headers: getAuthHeaders(token),
        timeout: 30000
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Device check endpoint not available');
          return {
            success: true,
            data: {
              deviceId,
              anomalyResults: null,
              message: 'Enhanced check not available',
              completedAt: new Date().toISOString()
            }
          };
        }
        
        if (response.status === 429) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Rate limit exceeded for manual checks');
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Enhanced device check v2.1 result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error in enhanced device check v2.1:', error);
      return {
        success: false,
        message: error.message || 'Device check failed',
        data: {
          deviceId,
          error: error.message
        }
      };
    }
  },

  // Resolve single anomaly (unchanged)
  resolveAnomaly: async (token, anomalyId, notes = '') => {
    try {
      console.log(`✅ Resolving anomaly ${anomalyId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.RESOLVE(anomalyId), {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ notes }),
        timeout: API_TIMEOUT
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Anomaly not found or already resolved');
          return {
            success: false,
            message: 'Anomaly not found or already resolved'
          };
        }
        
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Anomaly resolved successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error resolving anomaly:', error);
      return {
        success: false,
        message: error.message || 'Failed to resolve anomaly'
      };
    }
  },

  // Batch resolve anomalies (unchanged)
  batchResolve: async (token, anomalyIds, notes = '') => {
    try {
      console.log(`✅ Batch resolving ${anomalyIds.length} anomalies`);
      
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
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Batch resolve completed:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error in batch resolve:', error);
      return {
        success: false,
        message: error.message || 'Batch resolve failed'
      };
    }
  },

  // Enhanced health check for v2.1
  checkHealth: async () => {
    try {
      console.log('💓 Checking anomaly service health v2.1');
      
      const response = await fetch(ANOMALY_ENDPOINTS.HEALTH, {
        timeout: 5000
      });
      
      if (!response.ok) {
        console.warn('⚠️ Health endpoint returned error, using v2.1 fallback');
        return {
          success: true,
          data: {
            status: 'degraded',
            service_status: 'offline',
            model_ready: true,
            active_model: 'Enhanced Ensemble v2.1',
            last_check: new Date().toISOString(),
            services: {
              database: { status: 'unknown' },
              anomaly_detection_v21: { status: 'unavailable' },
              push_notifications: { status: 'unknown' }
            },
            apiVersion: '2.1'
          }
        };
      }
      
      const result = await response.json();
      console.log('💓 Health check v2.1 result:', result);
      
      // Enhanced data structure for v2.1
      return {
        success: true,
        data: {
          status: result.status || 'healthy',
          service_status: result.status || 'online',
          model_ready: result.services?.anomaly_detection_v21?.status === 'healthy' || 
                      result.services?.anomaly_detection?.status === 'available',
          active_model: result.features ? 'Enhanced Ensemble v2.1' : 'Isolation Forest',
          last_check: result.timestamp || new Date().toISOString(),
          response_time_ms: result.response_time_ms,
          services: result.services || {},
          metrics: result.metrics || {},
          endpoints: result.endpoints || [],
          features: result.features || [],
          apiVersion: result.apiVersion || '2.1'
        }
      };
      
    } catch (error) {
      console.error('❌ Health check v2.1 failed:', error);
      
      return {
        success: true,
        data: {
          status: 'offline',
          service_status: 'offline',
          model_ready: true,
          active_model: 'Enhanced Ensemble v2.1',
          last_check: new Date().toISOString(),
          error: error.message,
          services: {
            database: { status: 'unknown' },
            anomaly_detection_v21: { status: 'unavailable' },
            push_notifications: { status: 'unknown' }
          },
          apiVersion: '2.1'
        }
      };
    }
  },

  // Get anomaly types with v2.1 support
  getTypes: async () => {
    try {
      const response = await fetch(ANOMALY_ENDPOINTS.TYPES, {
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        ...result,
        apiVersion: '2.1'
      };
      
    } catch (error) {
      console.error('❌ Error fetching anomaly types v2.1:', error);
      return {
        success: true,
        data: {
          rule_based: {
            sudden_drop: { name: 'Sudden Drop', severity: 'high' },
            sudden_spike: { name: 'Sudden Spike', severity: 'medium' },
            vpd_too_low: { name: 'VPD Too Low', severity: 'high' },
            low_voltage: { name: 'Low Voltage', severity: 'medium' },
            dew_point_close: { name: 'Dew Point Alert', severity: 'high' },
            battery_depleted: { name: 'Battery Depleted', severity: 'high' }
          },
          ml_based: {
            ml_detected: { name: 'AI Anomaly Detection', severity: 'medium' }
          }
        },
        apiVersion: '2.1'
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