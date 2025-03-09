import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.1.12:3000';

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

export default function ErrorHistory() {
  const router = useRouter();
  const { errorHistory } = useLocalSearchParams() || {};
  const [errors, setErrors] = useState(JSON.parse(errorHistory || '[]'));
  const [apiErrors, setApiErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        setLoading(true);
        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/api/user/sensor-data`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        console.log('API Response Status (ErrorHistory):', response.status);

        if (response.status === 401) {
          await AsyncStorage.removeItem('token');
          router.replace('/signin');
          throw new Error('Session expired. Please log in again.');
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) throw new Error("ไม่มีข้อมูลเซ็นเซอร์");

        const issues = data.data.map(entry => {
          const errors = [];
          if (
            entry.temperature === 0 &&
            entry.humidity === 0 &&
            (entry.co2 === 0 || entry.co2 === undefined) &&
            (entry.ec === 0 || entry.ec === undefined) &&
            (entry.ph === 0 || entry.ph === undefined)
          ) {
            errors.push({ type: 'ไฟดับ', timestamp: entry.timestamp, details: 'ทุกค่าของเซ็นเซอร์ (อุณหภูมิ, ความชื้น, CO2, EC, pH) เป็น 0' });
          }
          if ((entry.ec === 0 || entry.ec === undefined) || (entry.ph === 0 || entry.ph === undefined)) {
            errors.push({ type: 'ถ่านหมด', timestamp: entry.timestamp, details: 'ค่า EC หรือ pH เป็น 0' });
          }
          if (entry.ph !== undefined && (entry.ph < 3 || entry.ph > 10)) {
            errors.push({ type: 'เซ็นเซอร์เสีย', timestamp: entry.timestamp, details: 'ค่า pH อยู่นอกช่วง 3-10' });
          }
          if (entry.co2 !== undefined && entry.co2 < 200) {
            errors.push({ type: 'เซ็นเซอร์เสีย', timestamp: entry.timestamp, details: 'ค่า CO2 ต่ำกว่า 200 ppm' });
          }
          return errors;
        }).flat().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setApiErrors(issues);
      } catch (error) {
        console.error("ข้อผิดพลาดในการดึงข้อมูลประวัติข้อผิดพลาด:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.errorItem}>
      <Text style={styles.errorTitle}>{item.type}</Text>
      <Text style={styles.errorDetails}>{item.details}</Text>
      <Text style={styles.errorTimestamp}>{new Date(item.timestamp).toLocaleString('th-TH')}</Text>
    </View>
  );

  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      {loading ? (
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      ) : (
        <Text style={styles.noDataText}>ไม่พบข้อผิดพลาด</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.header}>ErrorHistory</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.listContent}
        data={apiErrors}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        ListEmptyComponent={<EmptyListComponent />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerSpacer: {
    flex: 1, // Push content to left
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  errorItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  errorDetails: {
    fontSize: 14,
    color: '#4A5568',
    marginTop: 6,
  },
  errorTimestamp: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
  },
});