import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://172.16.22.133:3000';

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    const navigation = useNavigation();
    navigation.replace('/signin');
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

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/api/user/sensor-data`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('API Response Status:', response.status);
        console.log('API Response Headers:', response.headers);

        if (response.status === 401) {
          await AsyncStorage.removeItem('token');
          navigation.replace('/signin');
          throw new Error('Session expired. Please log in again.');
        }

        const data = await response.json();

        console.log('API Response Data:', data);

        if (!data.data || data.data.length === 0) throw new Error("ไม่มีข้อมูลเซ็นเซอร์");

        const issues = data.data.map(entry => {
          const errors = [];
          if (entry.temperature === 0 && entry.humidity === 0) {
            errors.push({ type: 'ไฟดับ', timestamp: entry.timestamp, details: 'ทุกค่าของเซ็นเซอร์เป็น 0' });
          }
          if (entry.temperature === null || entry.humidity === null) {
            errors.push({ type: 'เซ็นเซอร์เสีย', timestamp: entry.timestamp, details: 'ข้อมูลเซ็นเซอร์หายไป' });
          }
          return errors;
        }).flat();

        setCurrentIssues(issues);
      } catch (error) {
        console.error("ข้อผิดพลาดในการดึงข้อมูลเซ็นเซอร์:", error);
      }
    };

    fetchSensorData();
  }, []);

  const handleViewErrorHistory = () => {
    navigation.navigate('error-history', { errorHistory: JSON.stringify(currentIssues) }); // แก้เป็นชื่อเส้นทางสัมพันธ์
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.fg}>
          <Text style={styles.header}>System Status</Text>
          <Switch value={true} trackColor={{ false: '#ccc', true: '#4CAF50' }} />
        </View>

        <View style={styles.sensorContainer}>
          <Text style={styles.sensorText}>Sensor IBS-TH3</Text>
        </View>

        <View style={styles.statusGrid}>
          <View style={[styles.statusBox, { backgroundColor: '#E7F8E9' }]}>
            <Icon name="wifi" size={24} color="#4CAF50" />
            <Text style={styles.statusTitle}>WiFi Status</Text>
            <Text style={styles.statusText}>Connected</Text>
          </View>
          <View style={[styles.statusBox, { backgroundColor: '#FFF3CD' }]}>
            <Icon name="battery-alert" size={24} color="#FFA000" />
            <Text style={styles.statusTitle}>Battery Status</Text>
            <Text style={styles.statusText}>20%</Text>
          </View>
          <View style={[styles.statusBox, { backgroundColor: '#E3EAFD' }]}>
            <Icon name="data-usage" size={24} color="#1976D2" />
            <Text style={styles.statusTitle}>Data Status</Text>
            <Text style={styles.statusText}>Normal</Text>
          </View>
          <View style={[styles.statusBox, { backgroundColor: '#FDE8E8' }]}>
            <Icon name="error" size={24} color="#D32F2F" />
            <Text style={styles.statusTitle}>Device Health</Text>
            <Text style={styles.statusText}>Error</Text>
          </View>
        </View>

        <Text style={styles.subHeader}>Current Issues</Text>
        {currentIssues.slice(0, 2).map((issue, index) => (
          <View key={index} style={styles.issueBox}>
            <Icon name="error" size={24} color="red" />
            <View>
              <Text style={styles.issueTitle}>{issue.type}</Text>
              <Text style={styles.issueText}>{issue.details}</Text>
              <Text style={styles.issueTimestamp}>{issue.timestamp}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={handleViewErrorHistory} style={styles.errorHistory}>
          <Icon name="history" size={24} color="#1976D2" />
          <Text style={styles.historyText}>View past error reports</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, padding: 20 },
  fg: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  header: { fontSize: 26, fontWeight: 'bold', marginBottom: 10 },
  sensorContainer: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15 },
  sensorText: { fontSize: 18, fontWeight: '500' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statusBox: { width: '48%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  statusTitle: { fontSize: 14, color: '#555' },
  statusText: { fontSize: 16, fontWeight: 'bold' },
  subHeader: { fontSize: 20, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  issueBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10 },
  issueTitle: { fontSize: 16, fontWeight: 'bold', color: 'red' },
  issueText: { fontSize: 14, color: '#333' },
  issueTimestamp: { fontSize: 12, color: '#555' },
  errorHistory: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginTop: 15 },
  historyText: { fontSize: 16, color: '#1976D2', marginLeft: 10 },
});