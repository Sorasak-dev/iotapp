import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Platform, StatusBar } from 'react-native';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import { BarChart } from 'react-native-chart-kit';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, DATA_REFRESH_INTERVAL, getAuthHeaders } from '../utils/config/api';

const screenWidth = Dimensions.get('window').width;
const isIOS = Platform.OS === 'ios';

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('No authentication token found. Please log in.');
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    throw error;
  }
};

export default function DeviceMonitor() {
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [showTempChart, setShowTempChart] = useState(false);
  const [showHumidityChart, setShowHumidityChart] = useState(false);
  const [showDewPointChart, setShowDewPointChart] = useState(false);
  const [showVpdChart, setShowVpdChart] = useState(false);
  const [sensorData, setSensorData] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  
  const [deviceName, setDeviceName] = useState("Sensor Device");
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    let parsedDevice = null;
    
    if (route.params?.device) {
      try {
        if (typeof route.params.device === 'string') {
          parsedDevice = JSON.parse(route.params.device);
        } else {
          parsedDevice = route.params.device;
        }
        
        if (parsedDevice && parsedDevice.name) {
          setDeviceName(parsedDevice.name);
        }
        if (parsedDevice && parsedDevice._id) {
          setDeviceId(parsedDevice._id);
        }
      } catch (error) {
        console.error("Error parsing device data:", error);
      }
    }
    
    const getBatteryLevel = async () => {
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(Math.round(level * 100));
    };
    getBatteryLevel();

    const fetchSensorData = async () => {
      try {
        const token = await getAuthToken();
        
        let apiUrl = API_ENDPOINTS.SENSOR_DATA;
        if (parsedDevice && parsedDevice._id) {
          apiUrl = `${API_ENDPOINTS.DEVICES}/${parsedDevice._id}/data?limit=20`;
          console.log(`✅ Fetching data for device: ${parsedDevice.name} (ID: ${parsedDevice._id})`);
        } else {
          console.warn("⚠️ No device ID found, using default sensor data endpoint");
        }

        const response = await fetch(apiUrl, {
          headers: getAuthHeaders(token),
        });

        if (response.status === 401) {
          await AsyncStorage.removeItem('token');
          navigation.replace('/signin');
          throw new Error('Session expired. Please log in again.');
        }

        const result = await response.json();
        let data;

        if (parsedDevice && parsedDevice._id && result.data) {
          data = { data: result.data };
        } else {
          data = result;
        }

        if (!data.data || data.data.length === 0) {
          setErrorMessage("No sensor data found");
          setSensorData({
            temperature: { labels: [], values: [] },
            humidity: { labels: [], values: [] },
            dewPoint: { labels: [], values: [] },
            vpd: { labels: [], values: [] },
          });
          setLatestData(null);
          return;
        }

        let validData = data.data
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 5);

        if (validData.length > 0) {
          const latestEntry = validData[0];
          console.log(`📊 Latest Data for ${parsedDevice?.name || 'device'}:`, {
            temperature: latestEntry.temperature,
            humidity: latestEntry.humidity,
            dewPoint: latestEntry.dew_point,
            vpd: latestEntry.vpd,
            timestamp: latestEntry.timestamp
          });
          
          setLatestData({
            temperature: latestEntry.temperature,
            humidity: latestEntry.humidity,
            dewPoint: latestEntry.dew_point,
            vpd: latestEntry.vpd,
            updatedAt: latestEntry.timestamp,
          });

          setSensorData({
            temperature: {
              labels: validData.map(entry => `${new Date(entry.timestamp).getHours()}.00`),
              values: validData.map(entry => entry.temperature || 0),
            },
            humidity: {
              labels: validData.map(entry => `${new Date(entry.timestamp).getHours()}.00`),
              values: validData.map(entry => entry.humidity || 0),
            },
            dewPoint: {
              labels: validData.map(entry => `${new Date(entry.timestamp).getHours()}.00`),
              values: validData.map(entry => entry.dew_point || 0),
            },
            vpd: {
              labels: validData.map(entry => `${new Date(entry.timestamp).getHours()}.00`),
              values: validData.map(entry => entry.vpd || 0),
            },
          });
          setErrorMessage(null);
        } else {
          setSensorData({
            temperature: { labels: [], values: [] },
            humidity: { labels: [], values: [] },
            dewPoint: { labels: [], values: [] },
            vpd: { labels: [], values: [] },
          });
          setLatestData(null);
          setErrorMessage("No active sensors");
        }
      } catch (error) {
        console.error("❌ Error fetching sensor data:", error);
        setErrorMessage(error.message || "Failed to load sensor data");
        setSensorData({
          temperature: { labels: [], values: [] },
          humidity: { labels: [], values: [] },
          dewPoint: { labels: [], values: [] },
          vpd: { labels: [], values: [] },
        });
        setLatestData(null);
      }
    };

    fetchSensorData();
    const interval = setInterval(fetchSensorData, DATA_REFRESH_INTERVAL); 
    return () => clearInterval(interval);
  }, [route.params?.device]); 

  const renderChart = (data, color, type) => {
    if (!data || !data.labels.length) {
      return <Text style={styles.noDataText}>No data</Text>;
    }

    const chartConfig = {
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#f0f4f8',
      decimalPlaces: 2,
      color: () => color,
      labelColor: () => '#333',
      strokeWidth: 2,
      barPercentage: 0.6,
      propsForBars: { rx: 4, ry: 4 },
      fillShadowGradient: color,
      fillShadowGradientOpacity: 0.6,
    };

    return (
      <TouchableOpacity onPress={() => navigation.navigate('full-chart', { data: JSON.stringify(data), color, type })}>
        <View style={styles.chartContainer}>
          <BarChart
            data={{ labels: data.labels, datasets: [{ data: data.values }] }}
            width={screenWidth - 40}
            height={220}
            yAxisLabel=""
            chartConfig={chartConfig}
            style={styles.chartStyle}
            verticalLabelRotation={20}
            fromZero
          />
        </View>
      </TouchableOpacity>
    );
  };

  const handleSensorPress = () => {
    navigation.navigate('sensor-detail', { 
      sensorData: JSON.stringify(sensorData), 
      latestData: JSON.stringify(latestData),
      device: route.params?.device
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.header}>Device Monitor</Text>
          </View>

          <Text style={styles.subHeader}>Sensor Data Overview</Text>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Modified sensor card with arrow indicator */}
          <TouchableOpacity onPress={handleSensorPress}>
            <View style={styles.sensorCard}>
              <View style={styles.sensorInfo}>
                <FontAwesome5 name="microchip" size={20} color="black" />
                <Text style={styles.sensorTitle}>{deviceName}</Text>
              </View>

              {/* Added arrow icon to indicate the card is clickable */}
              <MaterialIcons name="keyboard-arrow-right" size={24} color="black" />
            </View>
          </TouchableOpacity>

          {latestData ? (
            <>
              <TouchableOpacity onPress={() => setShowTempChart(!showTempChart)}>
                <View style={styles.dataCard}>
                  <FontAwesome5 name="temperature-high" size={20} color="#3b82f6" />
                  <View style={styles.dataText}>
                    <Text style={styles.dataTitle}>Temperature</Text>
                    <Text style={styles.dataValue}>{latestData.temperature !== null ? `${latestData.temperature}°C` : 'N/A'}</Text>
                    <Text style={styles.dataUpdate}>Updated {new Date(latestData.updatedAt).toLocaleString()}</Text>
                  </View>
                  <MaterialIcons name={showTempChart ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="black" />
                </View>
              </TouchableOpacity>
              {showTempChart && renderChart(sensorData?.temperature, '#3b82f6', 'temperature')}

              <TouchableOpacity onPress={() => setShowHumidityChart(!showHumidityChart)}>
                <View style={styles.dataCard}>
                  <FontAwesome5 name="tint" size={20} color="#f59e0b" />
                  <View style={styles.dataText}>
                    <Text style={styles.dataTitle}>Humidity</Text>
                    <Text style={styles.dataValue}>{latestData.humidity !== null ? `${latestData.humidity}%` : 'N/A'}</Text>
                    <Text style={styles.dataUpdate}>Updated {new Date(latestData.updatedAt).toLocaleString()}</Text>
                  </View>
                  <MaterialIcons name={showHumidityChart ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="black" />
                </View>
              </TouchableOpacity>
              {showHumidityChart && renderChart(sensorData?.humidity, '#f59e0b', 'humidity')}

              <TouchableOpacity onPress={() => setShowDewPointChart(!showDewPointChart)}>
                <View style={styles.dataCard}>
                  <FontAwesome5 name="cloud-rain" size={20} color="#06b6d4" />
                  <View style={styles.dataText}>
                    <Text style={styles.dataTitle}>Dew Point</Text>
                    <Text style={styles.dataValue}>{latestData.dewPoint !== null ? `${latestData.dewPoint}°C` : 'N/A'}</Text>
                    <Text style={styles.dataUpdate}>Updated {new Date(latestData.updatedAt).toLocaleString()}</Text>
                  </View>
                  <MaterialIcons name={showDewPointChart ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="black" />
                </View>
              </TouchableOpacity>
              {showDewPointChart && renderChart(sensorData?.dewPoint, '#06b6d4', 'dewPoint')}

              <TouchableOpacity onPress={() => setShowVpdChart(!showVpdChart)}>
                <View style={styles.dataCard}>
                  <FontAwesome5 name="wind" size={20} color="#22c55e" />
                  <View style={styles.dataText}>
                    <Text style={styles.dataTitle}>Vapor Pressure Deficit (VPD)</Text>
                    <Text style={styles.dataValue}>{latestData.vpd !== null ? `${latestData.vpd} kPa` : 'N/A'}</Text>
                    <Text style={styles.dataUpdate}>Updated {new Date(latestData.updatedAt).toLocaleString()}</Text>
                  </View>
                  <MaterialIcons name={showVpdChart ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="black" />
                </View>
              </TouchableOpacity>
              {showVpdChart && renderChart(sensorData?.vpd, '#22c55e', 'vpd')}
            </>
          ) : (
            <Text style={styles.noDataText}>Loading sensor data...</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: isIOS ? 0 : StatusBar.currentHeight },
  scrollContainer: { flex: 1 },
  container: { flex: 1, padding: 16, backgroundColor: '#F8FAFC' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 10 },
  header: { fontSize: 24, fontWeight: 'bold', marginLeft: 10 },
  subHeader: { fontSize: 16, color: 'gray', marginBottom: 20, marginLeft: 10 },
  sensorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sensorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sensorTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 12 },
  dataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dataText: { marginLeft: 12, flex: 1 },
  dataTitle: { fontSize: 14, color: 'gray' },
  dataValue: { fontSize: 20, fontWeight: 'bold' },
  dataUpdate: { fontSize: 12, color: 'gray' },
  noDataText: { textAlign: 'center', marginVertical: 16, color: 'gray' },
  errorContainer: { backgroundColor: '#F8D7DA', padding: 10, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#721C24', textAlign: 'center' },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  chartStyle: { borderRadius: 16 },
});