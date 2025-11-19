import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform,
  ActivityIndicator 
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS, getAuthHeaders } from '../utils/config/api';

const screenWidth = 300;

const FullChart = () => {
  const { data: initialData, color, type, deviceId } = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [exporting, setExporting] = useState(false); 
  const router = useRouter();

  useEffect(() => {
    const fetchFullSensorData = async () => {
      try {
        setLoading(true);
        console.log('📊 Fetching chart data for device:', deviceId);
        
        const token = await AsyncStorage.getItem('token');
        
        if (!deviceId) {
          console.error('❌ No deviceId provided');
          setLoading(false);
          return;
        }

        // แก้ไข API endpoint
        const apiUrl = `${API_ENDPOINTS.DEVICES}/${deviceId}/data?limit=1000`;
        console.log('🔗 API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          headers: getAuthHeaders(token),
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Data received:', result.data?.length || 0, 'entries');

        if (result.data && result.data.length > 0) {
          setSensorData(result.data);
        } else {
          console.warn('⚠️ No data available');
          setSensorData([]);
        }
      } catch (error) {
        console.error('❌ Error fetching sensor data:', error);
        setSensorData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFullSensorData();
  }, [deviceId]);

  const reloadDataForDate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  // ใช้ข้อมูลจาก API แทน initialData
  const parsedData = sensorData || [];
  const hasValidData = parsedData && Array.isArray(parsedData) && parsedData.length > 0;

  console.log('📈 Chart type:', type);
  console.log('📅 Selected date:', selectedDate.toLocaleDateString());
  console.log('💾 Available data points:', parsedData.length);

  const filteredData = hasValidData
    ? parsedData
        .filter(entry => {
          const entryDate = new Date(entry.timestamp);
          const isMatch = (
            entryDate.getFullYear() === selectedDate.getFullYear() &&
            entryDate.getMonth() === selectedDate.getMonth() &&
            entryDate.getDate() === selectedDate.getDate()
          );
          return isMatch;
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    : [];

  console.log('✅ Filtered data points:', filteredData.length);

  const chartData = {
    labels: filteredData.length > 0 
      ? filteredData.map(entry => {
          const date = new Date(entry.timestamp);
          return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        })
      : ['No Data'],
    datasets: [{
      data: filteredData.length > 0
        ? filteredData.map(entry => {
            let value;
            switch (type) {
              case 'temperature': value = entry.temperature; break;
              case 'humidity': value = entry.humidity; break;
              case 'dewPoint': value = entry.dew_point; break;
              case 'vpd': value = entry.vpd; break;
              default: value = 0;
            }
            return value !== null && value !== undefined ? value : 0;
          })
        : [0],
    }],
  };

  const onChangeDate = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
      reloadDataForDate(); 
    }
  };

  const handleExportPress = async () => {
    if (filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }
    
    try {
      setExporting(true); 
      
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      const dataField = type === 'dewPoint' ? 'dew_point' : type;
      
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
          </head>
          <body>
            <h1>${typeLabel} Data Report</h1>
            <p>Date: ${selectedDate.toLocaleDateString('en-US')}</p>
            <p>Total Data Points: ${filteredData.length}</p>
            <table>
              <tr>
                <th>Time</th>
                <th>${typeLabel}</th>
              </tr>
              ${filteredData.map(entry => `
                <tr>
                  <td>${new Date(entry.timestamp).toLocaleTimeString('en-US')}</td>
                  <td>${entry[dataField] !== null && entry[dataField] !== undefined ? entry[dataField] : 'N/A'}</td>
                </tr>
              `).join('')}
            </table>
            <div class="footer">Generated on ${new Date().toLocaleString('en-US')}</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${typeLabel} Data PDF`,
        UTI: 'com.adobe.pdf',
      });

      alert("PDF exported successfully!");
    } catch (error) {
      alert("Failed to export PDF: " + error.message);
    } finally {
      setExporting(false); 
    }
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#f0f4f8',
    decimalPlaces: 1,
    color: () => color || '#888',
    labelColor: () => '#333',
    strokeWidth: 2,
    barPercentage: 0.6,
    propsForBars: { rx: 4, ry: 4 },
    fillShadowGradient: color,
    fillShadowGradientOpacity: 0.6,
  };

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.header}>{typeLabel} Chart</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        <View style={styles.container}>
          <View style={styles.dateExportContainer}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
              <Text style={styles.datePickerText}>
                📅 {selectedDate.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleExportPress} 
              style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
              disabled={exporting || filteredData.length === 0}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="download" size={16} color="#fff" style={styles.exportIcon} />
                  <Text style={styles.exportText}>Export</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading data...</Text>
            </View>
          ) : filteredData.length > 0 ? (
            <View style={styles.chartContainer}>
              <View style={styles.dataInfo}>
                <Text style={styles.dataInfoText}>
                  {filteredData.length} data points
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <BarChart
                  data={chartData}
                  width={Math.max(screenWidth, filteredData.length * 50)}
                  height={400}
                  yAxisLabel=""
                  chartConfig={chartConfig}
                  style={styles.chartStyle}
                  verticalLabelRotation={30}
                  fromZero
                  showValuesOnTopOfBars={filteredData.length <= 24}
                />
              </ScrollView>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <FontAwesome5 name="chart-bar" size={50} color="#ccc" />
              <Text style={styles.noDataText}>No data available for this date</Text>
              <Text style={styles.noDataSubtext}>
                {parsedData.length > 0 
                  ? 'Try selecting a different date' 
                  : 'No sensor data found for this device'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  scrollContainer: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  contentContainer: { 
    alignItems: 'center', 
    paddingVertical: 20 
  },
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#F8FAFC', 
    alignItems: 'center',
    width: '100%'
  },
  header: { 
    fontSize: 22, 
    fontWeight: 'bold',
    textAlign: 'left',
  },
  dateExportContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  datePickerButton: { 
    flex: 1,
    padding: 12, 
    backgroundColor: '#FFF', 
    borderRadius: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4,
    elevation: 2,
  },
  datePickerText: { 
    fontSize: 16, 
    color: '#007AFF',
    fontWeight: '500'
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28A745',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 90,
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  exportIcon: { 
    marginRight: 6 
  },
  exportText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  chartContainer: {
    width: '100%',
    marginTop: 10,
  },
  dataInfo: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  dataInfoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  chartStyle: { 
    borderRadius: 16, 
    marginVertical: 8 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  noDataText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 16,
    fontWeight: '500'
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default FullChart;