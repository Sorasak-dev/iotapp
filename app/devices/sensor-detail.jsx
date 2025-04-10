import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity, SafeAreaView, Dimensions, Platform, StatusBar, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS, getAuthHeaders } from '../utils/config/api';
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
  const { sensorData, latestData } = route.params || {};
  const parsedSensorData = JSON.parse(sensorData || '[]');
  const parsedLatestData = JSON.parse(latestData || '{}');
  const [currentIssues, setCurrentIssues] = useState([]);
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [batteryStatus, setBatteryStatus] = useState('20%');
  const [deviceHealth, setDeviceHealth] = useState('Normal');
  const [wifiStatus, setWifiStatus] = useState('Connected');
  const [dataStatus, setDataStatus] = useState('Normal');
  const [isLoading, setIsLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchSensorData();
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_ENDPOINTS.SENSOR_DATA.split('/user/sensor-data')[0]}/anomaly/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.replace('/signin');
        throw new Error('Session expired. Please log in again.');
      }

      const statusData = await response.json();
      console.log('Model Status:', statusData);

      if (statusData.success) {
        setModelStatus(statusData.data);
      }
    } catch (error) {
      console.error('Error checking model status:', error);
      Alert.alert('Error', 'Failed to check anomaly detection model status');
    }
  };

  const fetchSensorData = async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      
      // 1. ดึงข้อมูลเซ็นเซอร์จาก API
      const response = await fetch(API_ENDPOINTS.SENSOR_DATA, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.replace('/signin');
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json();
      console.log('Sensor data response:', data);

      if (!data.data || data.data.length === 0) {
        setIsLoading(false);
        throw new Error("ไม่มีข้อมูลเซ็นเซอร์");
      }

      // 2. ตรวจสอบปัญหาพื้นฐาน
      const basicIssues = data.data.map(entry => {
        const errors = [];
        if (entry.temperature === 0 && entry.humidity === 0) {
          errors.push({ type: 'ไฟดับ', timestamp: entry.timestamp, details: 'ทุกค่าของเซ็นเซอร์เป็น 0' });
        }
        if (entry.temperature === null || entry.humidity === null) {
          errors.push({ type: 'เซ็นเซอร์เสีย', timestamp: entry.timestamp, details: 'ข้อมูลเซ็นเซอร์หายไป' });
        }
        return errors;
      }).flat();

      // 3. เรียกใช้ API Anomaly Detection สำหรับข้อมูลล่าสุด (เฉพาะรายการล่าสุด)
      try {
        const latestEntry = data.data[data.data.length - 1];
        
        const anomalyResponse = await fetch(`${API_ENDPOINTS.SENSOR_DATA.split('/user/sensor-data')[0]}/anomaly/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(latestEntry)
        });

        if (anomalyResponse.ok) {
          const anomalyResult = await anomalyResponse.json();
          console.log('Anomaly detection result:', anomalyResult);

          // ตรวจสอบว่ามีความผิดปกติหรือไม่
          if (anomalyResult.success && anomalyResult.data.prediction.is_anomaly) {
            // กำหนดประเภทของความผิดปกติตามข้อมูล
            let anomalyType = 'ความผิดปกติของข้อมูลเซ็นเซอร์';
            let details = 'ตรวจพบรูปแบบข้อมูลที่ผิดปกติ';

            const sensorValues = anomalyResult.data.original_data;
            
            // วิเคราะห์ประเภทของความผิดปกติ
            if (sensorValues.temperature > 40) {
              anomalyType = 'อุณหภูมิสูงผิดปกติ';
              details = `อุณหภูมิวัดได้ ${sensorValues.temperature}°C ซึ่งสูงกว่าปกติ`;
            } else if (sensorValues.temperature < 10) {
              anomalyType = 'อุณหภูมิต่ำผิดปกติ';
              details = `อุณหภูมิวัดได้ ${sensorValues.temperature}°C ซึ่งต่ำกว่าปกติ`;
            } else if (sensorValues.humidity > 90) {
              anomalyType = 'ความชื้นสูงผิดปกติ';
              details = `ความชื้นวัดได้ ${sensorValues.humidity}% ซึ่งสูงกว่าปกติ`;
            } else if (sensorValues.humidity < 20) {
              anomalyType = 'ความชื้นต่ำผิดปกติ';
              details = `ความชื้นวัดได้ ${sensorValues.humidity}% ซึ่งต่ำกว่าปกติ`;
            }

            // เพิ่มข้อมูลความผิดปกติลงในรายการปัญหา
            const anomalyIssue = {
              type: anomalyType,
              timestamp: sensorValues.timestamp || new Date().toISOString(),
              details: details,
              score: anomalyResult.data.prediction.anomaly_score,
              isAnomalyDetection: true
            };

            basicIssues.push(anomalyIssue);
            
            // ปรับปรุงสถานะของอุปกรณ์
            setDeviceHealth('Error');
            setDataStatus('Anomaly Detected');
          }
        } else {
          console.error('Failed to perform anomaly detection');
        }
      } catch (anomalyError) {
        console.error('Error calling anomaly detection:', anomalyError);
      }

      // 4. รวมข้อมูลทั้งหมดและอัพเดตสถานะ
      setCurrentIssues(basicIssues);
      
      // ตั้งค่าสถานะอุปกรณ์ต่างๆ
      const latestEntry = data.data[data.data.length - 1];
      
      // สถานะแบตเตอรี่ (สมมติว่ามีข้อมูล battery_level)
      if (latestEntry.battery_level) {
        setBatteryStatus(`${latestEntry.battery_level}%`);
      }
      
      // สถานะ Wi-Fi (สมมติเชื่อมต่อถ้ามีข้อมูลล่าสุดไม่เกิน 1 ชั่วโมง)
      const lastUpdateTime = new Date(latestEntry.timestamp);
      const currentTime = new Date();
      const timeDiff = (currentTime - lastUpdateTime) / (1000 * 60); // นาที
      
      if (timeDiff > 60) { // ถ้าเกิน 1 ชั่วโมง ถือว่าขาดการเชื่อมต่อ
        setWifiStatus('Disconnected');
      }
      
      // ถ้ามีปัญหา ปรับสถานะอุปกรณ์เป็น Error
      if (basicIssues.length > 0) {
        setDeviceHealth('Error');
      }

    }catch (error) {
      console.error("Error fetching sensor data:", error);
      Alert.alert('Error', error.message || 'Failed to fetch sensor data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewErrorHistory = () => {
    router.push({
      pathname: "/notifications/error-history", 
      params: { errorHistory: JSON.stringify(currentIssues) }
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleToggleSensor = async (value) => {
    setSensorEnabled(value);
    
    try {
      const token = await getAuthToken();
      // API สำหรับเปิด/ปิดเซ็นเซอร์
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
        setSensorEnabled(!value); // เปลี่ยนกลับถ้า API ไม่สำเร็จ
      }
    } catch (error) {
      console.error('Error toggling sensor:', error);
      setSensorEnabled(!value); // เปลี่ยนกลับถ้าเกิดข้อผิดพลาด
    }
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
            <Switch 
              value={sensorEnabled} 
              onValueChange={handleToggleSensor}
              trackColor={{ false: '#ccc', true: '#4CAF50' }} 
              style={styles.switch}
            />
          </View>

          <View style={styles.sensorContainer}>
            <Text style={styles.sensorText}>Sensor IBS-TH3</Text>
            {modelStatus && (
              <View style={styles.modelStatus}>
                <Text style={styles.modelStatusText}>
                  Active Model: {modelStatus.active_model} 
                  {modelStatus.model_ready ? ' (Ready)' : ' (Not Ready)'}
                </Text>
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
              backgroundColor: deviceHealth === 'Normal' ? '#E7F8E9' : '#FDE8E8' 
            }]}>
              <Icon 
                name={deviceHealth === 'Normal' ? "check-circle" : "error"} 
                size={24} 
                color={deviceHealth === 'Normal' ? '#4CAF50' : '#D32F2F'} 
              />
              <Text style={styles.statusTitle}>Device Health</Text>
              <Text style={styles.statusText}>{deviceHealth}</Text>
            </View>
          </View>

          <Text style={styles.subHeader}>Current Issues</Text>
          
          {isLoading ? (
            <View style={styles.loadingBox}>
              <Icon name="hourglass-empty" size={24} color="#666" />
              <Text style={styles.loadingText}>Checking system status...</Text>
            </View>
          ) : currentIssues.length > 0 ? (
            currentIssues.slice(0, 2).map((issue, index) => (
              <View key={index} style={[
                styles.issueBox,
                issue.isAnomalyDetection && styles.anomalyIssueBox
              ]}>
                <Icon 
                  name={issue.isAnomalyDetection ? "warning" : "error"} 
                  size={24} 
                  color={issue.isAnomalyDetection ? "#FF9800" : "red"} 
                />
                <View style={styles.issueContent}>
                  <Text style={[
                    styles.issueTitle,
                    issue.isAnomalyDetection && styles.anomalyIssueTitle
                  ]}>
                    {issue.type}
                  </Text>
                  <Text style={styles.issueText}>{issue.details}</Text>
                  {issue.score && (
                    <Text style={styles.issueScore}>
                      Anomaly Score: {parseFloat(issue.score).toFixed(2)}
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
          
          {currentIssues.length > 2 && (
            <Text style={styles.moreIssues}>
              +{currentIssues.length - 2} more issues
            </Text>
          )}

          <TouchableOpacity onPress={handleViewErrorHistory} style={styles.errorHistory}>
            <Icon name="history" size={24} color="#1976D2" />
            <Text style={styles.historyText}>View past error reports</Text>
          </TouchableOpacity>
          
          {modelStatus && modelStatus.model_ready && (
            <View style={styles.aiFeatureBox}>
              <Icon name="analytics" size={24} color="#4527A0" />
              <View style={styles.aiFeatureContent}>
                <Text style={styles.aiFeatureTitle}>AI-powered anomaly detection</Text>
                <Text style={styles.aiFeatureText}>
                  This device uses machine learning to detect abnormal patterns in sensor data.
                </Text>
                <Text style={styles.aiFeatureModel}>
                  Current model: {modelStatus.active_model}
                </Text>
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
  header: { 
    fontSize: 24, 
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  switch: {
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
  subHeader: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginTop: 20, 
    marginBottom: 14,
    marginLeft: 4,
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
  issueContent: {
    marginLeft: 12,
    flex: 1,
  },
  issueTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: 'red' 
  },
  anomalyIssueTitle: {
    color: '#FF9800',
  },
  issueText: { 
    fontSize: 14, 
    color: '#333',
    marginTop: 4,
  },
  issueScore: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
    marginTop: 4,
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
});