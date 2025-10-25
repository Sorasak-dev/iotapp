import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Platform, StatusBar, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS, ANOMALY_ENDPOINTS, getAuthHeaders, AnomalyService } from '../utils/config/api';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const isIOS = Platform.OS === 'ios';

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    throw error;
  }
};

export default function SensorDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const { sensorData, latestData, device } = route.params || {};
  const parsedSensorData = JSON.parse(sensorData || '[]');
  const parsedLatestData = JSON.parse(latestData || '{}');
  
  const [deviceName, setDeviceName] = useState("Sensor Device");
  const [deviceId, setDeviceId] = useState(null);
  
  const [currentIssues, setCurrentIssues] = useState([]);
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [batteryStatus, setBatteryStatus] = useState('85%');
  const [deviceHealth, setDeviceHealth] = useState('Normal');
  const [wifiStatus, setWifiStatus] = useState('Connected');
  const [dataStatus, setDataStatus] = useState('Normal');
  const [isLoading, setIsLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState(null);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (device) {
      try {
        let deviceData;
        if (typeof device === 'string') {
          deviceData = JSON.parse(device);
        } else {
          deviceData = device;
        }
        
        if (deviceData && deviceData.name) {
          setDeviceName(deviceData.name);
        }
        if (deviceData && (deviceData._id || deviceData.deviceId)) {
          const id = deviceData._id || deviceData.deviceId;
          setDeviceId(id);
          
          setTimeout(() => {
            fetchSensorData(id);
            checkAnomalyHealth();
            loadAnomalyStats(id);
          }, 100);
        }
      } catch (error) {
        console.error("Error parsing device data:", error);
      }
    } else {
      fetchSensorData(null);
      checkAnomalyHealth();
      loadAnomalyStats(null);
    }
  }, [device]);

  const checkAnomalyHealth = async () => {
    try {
      console.log('Checking anomaly service health...');
      const healthData = await AnomalyService.checkHealth();
      
      if (healthData && healthData.data) {
        setModelStatus({
          model_ready: healthData.data.model_ready,
          active_model: healthData.data.active_model || 'Gradient Boosting Hybrid',
          service_status: healthData.data.service_status || healthData.data.status
        });
      }
    } catch (error) {
      console.error('Error in checkAnomalyHealth:', error);
      setModelStatus({
        model_ready: true,
        active_model: 'Gradient Boosting Hybrid',
        service_status: 'offline'
      });
    }
  };

  const loadAnomalyStats = async (currentDeviceId = null) => {
    try {
      console.log('Loading anomaly stats...');
      const token = await getAuthToken();
    
      const targetDeviceId = currentDeviceId || deviceId;
      
      const stats = await AnomalyService.getStats(token, 1);
      
      if (stats && stats.data) {
        setAnomalyStats({
          total_anomalies: stats.data.total_anomalies || 0,
          unresolved_count: stats.data.unresolved_count || 0,
          resolved_count: stats.data.resolved_count || 0,
          accuracy_rate: stats.data.accuracy_rate || 95.2
        });
      }
    } catch (error) {
      console.error('Error loading anomaly stats:', error);
      setAnomalyStats({
        total_anomalies: 0,
        unresolved_count: 0,
        resolved_count: 0,
        accuracy_rate: 95.2
      });
    }
  };

  const mapAlertLevelToSeverity = (alertLevel) => {
    const mapping = {
      'red': 'critical',
      'yellow': 'high',
      'green': 'low'
    };
    return mapping[alertLevel] || 'medium';
  };

  const loadRecentAnomalies = async (currentDeviceId = null) => {
    try {
      console.log('Loading recent anomalies...');
      
      const targetDeviceId = currentDeviceId || deviceId;
      
      if (!targetDeviceId) {
        console.warn('No deviceId available');
        return [];
      }

      const token = await getAuthToken();
      const filters = {
        deviceId: targetDeviceId,
        limit: 5,
        resolved: false
      };

      const response = await AnomalyService.getHistory(token, filters);
      
      if (response && response.success && response.data && response.data.anomalies) {
        const anomalyIssues = response.data.anomalies.map(anomaly => ({
          id: anomaly._id,
          type: getAnomalyTypeLabel(anomaly.anomalyType || anomaly.type || 'unknown'),
          timestamp: anomaly.timestamp,
          details: anomaly.message || `${anomaly.anomalyType || anomaly.type} detected`,
          score: anomaly.mlResults?.confidence || 0.8,
          severity: mapAlertLevelToSeverity(anomaly.alertLevel),
          isAnomalyDetection: true,
          status: anomaly.resolved ? 'resolved' : 'unresolved',
          device_name: deviceName,
          detection_method: anomaly.detectionMethod || 'hybrid'
        }));
        
        return anomalyIssues;
      }
      
      return [];
      
    } catch (error) {
      console.error('Error loading recent anomalies:', error);
      return [];
    }
  };

  const getAnomalyTypeLabel = (type) => {
    const typeMap = {
      'sudden_drop': 'Sudden Value Drop',
      'sudden_spike': 'Sudden Value Spike',
      'vpd_too_low': 'VPD Too Low',
      'low_voltage': 'Low Voltage',
      'dew_point_close': 'Dew Point Alert',
      'battery_depleted': 'Battery Depleted',
      'ml_detected': 'AI Anomaly Detection (Gradient Boosting)',
      'temperature_high': 'High Temperature Alert',
      'temperature_low': 'Low Temperature Alert',
      'humidity_high': 'High Humidity Alert',
      'humidity_low': 'Low Humidity Alert',
      'sensor_malfunction': 'Sensor Malfunction'
    };
    
    return typeMap[type] || 'Anomaly Detected';
  };

  const detectAnomaliesRealtime = async (latestReading) => {
    try {
      console.log('Running real-time anomaly detection...');
      
      if (!latestReading) {
        console.warn('No sensor reading available');
        return [];
      }

      const token = await getAuthToken();
      
      const sensorData = {
        temperature: latestReading.temperature,
        humidity: latestReading.humidity,
        voltage: latestReading.voltage,
        battery_level: latestReading.battery_level,
        co2: latestReading.co2,
        ec: latestReading.ec,
        ph: latestReading.ph,
        vpd: latestReading.vpd,
        dew_point: latestReading.dew_point,
        timestamp: latestReading.timestamp || new Date().toISOString()
      };

      const result = await AnomalyService.detectAnomaly(token, sensorData);
      
      if (!result.success) {
        console.warn('Detection failed:', result.message);
        return [];
      }

      const detectedAnomalies = [];

      if (result.details?.rule_based_detection) {
        result.details.rule_based_detection.forEach((detection, index) => {
          if (detection.is_anomaly) {
            detectedAnomalies.push({
              id: `rule_${Date.now()}_${index}`,
              type: getAnomalyTypeLabel(detection.anomaly_type || 'unknown'),
              timestamp: detection.timestamp || new Date().toISOString(),
              details: detection.message || 'Anomaly detected by rule-based system',
              score: detection.confidence || 0.95,
              severity: mapAlertLevelToSeverity(detection.alert_level),
              isAnomalyDetection: true,
              status: 'unresolved',
              isNew: true,
              detection_method: 'rule_based'
            });
          }
        });
      }

      if (result.details?.ml_detection) {
        result.details.ml_detection.forEach((detection, index) => {
          if (detection.is_anomaly) {
            detectedAnomalies.push({
              id: `ml_${Date.now()}_${index}`,
              type: 'AI Anomaly Detection (Gradient Boosting)',
              timestamp: detection.timestamp || new Date().toISOString(),
              details: `ML model detected unusual pattern (Confidence: ${(detection.confidence * 100).toFixed(1)}%)`,
              score: detection.confidence || 0.8,
              severity: 'high',
              isAnomalyDetection: true,
              status: 'unresolved',
              isNew: true,
              detection_method: 'ml_based',
              model_used: detection.model_used || 'gradient_boosting'
            });
          }
        });
      }

      if (result.details?.recommendations && result.details.recommendations.length > 0) {
        console.log('Recommendations:', result.details.recommendations);
      }

      console.log(`Detected ${detectedAnomalies.length} anomalies`);
      return detectedAnomalies;
      
    } catch (error) {
      console.error('Error in real-time detection:', error);
      return [];
    }
  };

  const fetchSensorData = async (currentDeviceId = null) => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      
      const targetDeviceId = currentDeviceId || deviceId;
      
      let apiUrl;
      if (targetDeviceId) {
        apiUrl = `${API_ENDPOINTS.DEVICES}/${targetDeviceId}/data?limit=100`;
      } else {
        apiUrl = API_ENDPOINTS.SENSOR_DATA;
      }
      
      const response = await fetch(apiUrl, {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      let data;
      
      if (targetDeviceId && result.data) {
        data = { success: true, data: result.data };
      } else {
        data = result;
      }
      
      if (!data.success || !data.data || data.data.length === 0) {
        throw new Error("No sensor data");
      }

      const basicIssues = data.data.map(entry => {
        const errors = [];
        if (entry.temperature === 0 && entry.humidity === 0) {
          errors.push({ 
            id: `power_${entry.timestamp}`,
            type: 'Power outage', 
            timestamp: entry.timestamp, 
            details: 'All sensor values are 0',
            isAnomalyDetection: false
          });
        }
        if (entry.temperature === null || entry.humidity === null) {
          errors.push({ 
            id: `malfunction_${entry.timestamp}`,
            type: 'Sensor malfunction', 
            timestamp: entry.timestamp, 
            details: 'Sensor data lost',
            isAnomalyDetection: false
          });
        }
        return errors;
      }).flat();

      let recentAnomalies = [];
      try {
        recentAnomalies = await loadRecentAnomalies(targetDeviceId);
      } catch (anomalyError) {
        console.error('Failed to load recent anomalies:', anomalyError);
        recentAnomalies = [];
      }

      const latestReading = data.data[data.data.length - 1];
      const realtimeAnomalies = await detectAnomaliesRealtime(latestReading);
      
      const allIssues = [...basicIssues, ...recentAnomalies, ...realtimeAnomalies];
      setCurrentIssues(allIssues);

      if (allIssues.length > 0) {
        const hasHighSeverity = allIssues.some(issue => 
          issue.severity === 'high' || issue.severity === 'critical'
        );
        setDeviceHealth(hasHighSeverity ? 'Critical' : 'Warning');
        
        const hasActiveAnomalies = allIssues.some(issue => issue.isAnomalyDetection);
        if (hasActiveAnomalies) {
          setDataStatus('Anomaly Detected');
        }
      } else {
        setDeviceHealth('Normal');
        setDataStatus('Normal');
      }
      
      const latestEntry = data.data[data.data.length - 1];
      
      if (latestEntry.battery_level) {
        setBatteryStatus(`${latestEntry.battery_level}%`);
      }
      
      const lastUpdateTime = new Date(latestEntry.timestamp);
      const currentTime = new Date();
      const timeDiff = (currentTime - lastUpdateTime) / (1000 * 60); 
      
      if (timeDiff > 60) { 
        setWifiStatus('Disconnected');
      } else {
        setWifiStatus('Connected');
      }

    } catch (error) {
      console.error("Error fetching sensor data:", error);
      Alert.alert('Error', error.message || 'Failed to fetch sensor data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewErrorHistory = () => {
  navigation.navigate('error-history', {
    errorHistory: JSON.stringify(currentIssues),
    deviceId: deviceId,
    deviceName: deviceName
  });
};

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleToggleSensor = async (value) => {
    setSensorEnabled(value);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_ENDPOINTS.DEVICES}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: value })
      });
      
      if (!response.ok) {
        console.error('Failed to toggle sensor state');
        setSensorEnabled(!value); 
      }
    } catch (error) {
      console.error('Error toggling sensor:', error);
      setSensorEnabled(!value); 
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#D32F2F';
      case 'high': return '#F57C00';
      case 'medium': return '#FFA000';
      case 'low': return '#388E3C';
      default: return '#FF9800';
    }
  };

  const refreshAnomalyData = async () => {
    await fetchSensorData(deviceId);
    await loadAnomalyStats(deviceId);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.header}>System Status</Text>
            <TouchableOpacity onPress={refreshAnomalyData} style={styles.refreshButton}>
              <Ionicons name="refresh" size={24} color="#1976D2" />
            </TouchableOpacity>
          </View>

          <View style={styles.sensorContainer}>
            <Text style={styles.sensorText}>{deviceName}</Text>
            {modelStatus && (
              <View style={styles.modelStatus}>
                <Text style={styles.modelStatusText}>
                  Anomaly Detection: {modelStatus.active_model} 
                  {modelStatus.model_ready ? ' (Active)' : ' (Inactive)'}
                </Text>
                <Text style={styles.serviceStatusText}>
                  Service: {modelStatus.service_status}
                </Text>
              </View>
            )}
            {anomalyStats && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  Last 24 hours: {anomalyStats.total_anomalies} anomalies detected
                </Text>
                {anomalyStats.unresolved_count > 0 && (
                  <Text style={styles.unresolvedText}>
                    {anomalyStats.unresolved_count} unresolved
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.statusGrid}>
            <View style={[styles.statusBox, { backgroundColor: wifiStatus === 'Connected' ? '#E7F8E9' : '#FDE8E8' }]}>
              <Icon name="wifi" size={24} color={wifiStatus === 'Connected' ? '#4CAF50' : '#D32F2F'} />
              <Text style={styles.statusTitle}>WiFi Status</Text>
              <Text style={styles.statusText}>{wifiStatus}</Text>
            </View>
            <View style={[styles.statusBox, { 
              backgroundColor: parseInt(batteryStatus) > 30 ? '#E7F8E9' : 
                             parseInt(batteryStatus) > 10 ? '#FFF3CD' : '#FDE8E8' 
            }]}>
              <Icon 
                name={
                  parseInt(batteryStatus) > 80 ? "battery-full" : 
                  parseInt(batteryStatus) > 50 ? "battery-std" :
                  parseInt(batteryStatus) > 20 ? "battery-alert" : "battery-unknown"
                } 
                size={24} 
                color={parseInt(batteryStatus) > 30 ? '#4CAF50' : 
                      parseInt(batteryStatus) > 10 ? '#FFA000' : '#D32F2F'} 
              />
              <Text style={styles.statusTitle}>Battery Status</Text>
              <Text style={styles.statusText}>{batteryStatus}</Text>
            </View>
            <View style={[styles.statusBox, { 
              backgroundColor: dataStatus === 'Normal' ? '#E3EAFD' : '#FFF3CD' 
            }]}>
              <Icon name="data-usage" size={24} color={dataStatus === 'Normal' ? '#1976D2' : '#FFA000'} />
              <Text style={styles.statusTitle}>Data Status</Text>
              <Text style={styles.statusText}>{dataStatus}</Text>
            </View>
            <View style={[styles.statusBox, { 
              backgroundColor: deviceHealth === 'Normal' ? '#E7F8E9' : 
                              deviceHealth === 'Warning' ? '#FFF3CD' : '#FDE8E8'
            }]}>
              <Icon 
                name={
                  deviceHealth === 'Normal' ? "check-circle" : 
                  deviceHealth === 'Warning' ? "warning" : "error"
                } 
                size={24} 
                color={
                  deviceHealth === 'Normal' ? '#4CAF50' : 
                  deviceHealth === 'Warning' ? '#FFA000' : '#D32F2F'
                } 
              />
              <Text style={styles.statusTitle}>Device Health</Text>
              <Text style={styles.statusText}>{deviceHealth}</Text>
            </View>
          </View>

          <View style={styles.subHeaderContainer}>
            <Text style={styles.subHeader}>Current Issues</Text>
            {currentIssues.length > 0 && (
              <Text style={styles.issueCount}>({currentIssues.length})</Text>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <Icon name="hourglass-empty" size={24} color="#666" />
              <Text style={styles.loadingText}>Checking system status...</Text>
            </View>
          ) : currentIssues.length > 0 ? (
            currentIssues.slice(0, 3).map((issue, index) => (
              <View key={issue.id || index} style={[
                styles.issueBox,
                issue.isAnomalyDetection && styles.anomalyIssueBox,
                issue.isNew && styles.newAnomalyBox
              ]}>
                <Icon 
                  name={
                    issue.isAnomalyDetection ? "warning" : 
                    issue.type.includes("Power") ? "power-off" :
                    issue.type.includes("Sensor") ? "error" : "error"
                  } 
                  size={24} 
                  color={
                    issue.isAnomalyDetection ? getSeverityColor(issue.severity) : "#D32F2F"
                  } 
                />
                <View style={styles.issueContent}>
                  <View style={styles.issueTitleRow}>
                    <Text style={[
                      styles.issueTitle,
                      issue.isAnomalyDetection && styles.anomalyIssueTitle
                    ]}>
                      {issue.type}
                    </Text>
                    {issue.isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.issueText}>{issue.details}</Text>
                  {issue.score && (
                    <Text style={styles.issueScore}>
                      Confidence: {parseFloat(issue.score).toFixed(2)}
                    </Text>
                  )}
                  {issue.severity && (
                    <Text style={[styles.issueSeverity, {color: getSeverityColor(issue.severity)}]}>
                      Severity: {issue.severity.toUpperCase()}
                    </Text>
                  )}
                  <Text style={styles.issueTimestamp}>
                    {new Date(issue.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noIssuesBox}>
              <Icon name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.noIssuesText}>No current issues detected</Text>
            </View>
          )}
          
          {currentIssues.length > 3 && (
            <Text style={styles.moreIssues}>
              +{currentIssues.length - 3} more issues
            </Text>
          )}

          <TouchableOpacity onPress={handleViewErrorHistory} style={styles.errorHistory}>
            <Icon name="history" size={24} color="#1976D2" />
            <Text style={styles.historyText}>View anomaly history</Text>
          </TouchableOpacity>
          
          {modelStatus && modelStatus.model_ready && (
            <View style={styles.aiFeatureBox}>
              <Icon name="analytics" size={24} color="#4527A0" />
              <View style={styles.aiFeatureContent}>
                <Text style={styles.aiFeatureTitle}>AI-powered anomaly detection</Text>
                <Text style={styles.aiFeatureText}>
                  This device uses machine learning to detect abnormal patterns in sensor data in real-time.
                </Text>
                <Text style={styles.aiFeatureModel}>
                  Active model: {modelStatus.active_model}
                </Text>
                {anomalyStats && (
                  <Text style={styles.aiFeatureStats}>
                    Detection accuracy: {anomalyStats.accuracy_rate || 'N/A'}%
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: isIOS ? 0 : StatusBar.currentHeight,
  },
  scrollContainer: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  container: { 
    flex: 1, 
    padding: 16,
    paddingBottom: 30,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  backButton: {
    padding: 10,
  },
  refreshButton: {
    padding: 10,
  },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  sensorContainer: { 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2,
  },
  sensorText: { 
    fontSize: 18, 
    fontWeight: '500' 
  },
  modelStatus: {
    marginTop: 8,
  },
  modelStatusText: {
    fontSize: 12,
    color: '#666',
  },
  serviceStatusText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  statsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  statsText: {
    fontSize: 12,
    color: '#333',
  },
  unresolvedText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '500',
    marginTop: 2,
  },
  statusGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  statusBox: { 
    width: '48%', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginBottom: 12,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },
  statusTitle: { 
    fontSize: 14, 
    color: '#555',
    marginTop: 6,
  },
  statusText: { 
    fontSize: 16, 
    fontWeight: 'bold',
    marginTop: 4,
  },
  subHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 14,
    marginLeft: 4,
  },
  subHeader: { 
    fontSize: 20, 
    fontWeight: 'bold',
  },
  issueCount: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
  },
  issueBox: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 10,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2,
  },
  anomalyIssueBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  newAnomalyBox: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  issueContent: {
    marginLeft: 12,
    flex: 1,
  },
  issueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issueTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: 'red',
    flex: 1,
  },
  anomalyIssueTitle: {
    color: '#FF9800',
  },
  newBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  issueText: { 
    fontSize: 14, 
    color: '#333',
    marginTop: 4,
  },
  issueScore: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 4,
  },
  issueSeverity: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  issueTimestamp: { 
    fontSize: 12, 
    color: '#555',
    marginTop: 4,
  },
  noIssuesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F8E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  noIssuesText: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 12,
  },
  moreIssues: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHistory: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 16,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2,
  },
  historyText: { 
    fontSize: 16, 
    color: '#1976D2', 
    marginLeft: 10 
  },
  aiFeatureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3E5F5',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  aiFeatureContent: {
    marginLeft: 12,
    flex: 1,
  },
  aiFeatureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4527A0',
  },
  aiFeatureText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  aiFeatureModel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  aiFeatureStats: {
    fontSize: 12,
    color: '#4527A0',
    marginTop: 4,
    fontWeight: '500',
  },
});