import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;
const isIOS = Platform.OS === 'ios';

const SENSOR_COLORS = [
  "#FF6384", // Red
  "#36A2EB", // Blue
  "#4BC0C0", // Teal
  "#22C55E", // Green
  "#FFCE56", // Yellow
  "#9966FF", // Purple
  "#FF9F40", // Orange
  "#20C997", // Mint
  "#6C757D", // Gray
  "#FD7E14"  // Dark Orange
];

export default function Statistics() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedMetrics, setSelectedMetrics] = useState(["Temperature", "Humidity", "Dew Point", "VPO"]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState({});  
  const [loading, setLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(windowWidth * 0.9);
  const [zones, setZones] = useState([]);
  const [zoneSensors, setZoneSensors] = useState([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [maxDataPoints, setMaxDataPoints] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setStartDate(today);
      setEndDate(today);
      setTempStartDate(today);
      setTempEndDate(today);
      
      fetchZones();
      
      return () => {};
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedZone) {
      fetchZoneSensors(selectedZone);
      setSelectedSensors([]); 
      setData({}); 
    }
  }, [selectedZone]);

  useEffect(() => {
    if (selectedSensors.length > 0) {
      fetchSensorData(startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
    } else {
      setData({});
    }
  }, [selectedSensors, startDate, endDate]);

  useEffect(() => {
    updateChartWidth();
  }, [maxDataPoints]);

  const updateChartWidth = () => {
    const minWidth = windowWidth * 0.9;
    const calculatedWidth = Math.max(minWidth, maxDataPoints * 80);
    setChartWidth(calculatedWidth);
  };

  const fetchZones = async () => {
    try {
      setLoadingZones(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoadingZones(false);
        return;
      }
  
      const response = await axios.get(API_ENDPOINTS.ZONES, {
        headers: getAuthHeaders(token),
      });
  
      console.log("API Response:", response.data); 
  
      const zonesData = Array.isArray(response.data) ? response.data : 
                       (response.data && response.data.zones ? response.data.zones : []);
      
      if (zonesData.length > 0) {
        const zoneOptions = zonesData.map(zone => ({
          label: zone.name || "Unnamed Zone",
          value: zone._id || zone.id
        }));
        
        setZones(zoneOptions);
        
        if (zoneOptions.length > 0 && !selectedZone) {
          setSelectedZone(zoneOptions[0].value);
        }
      } else {
        setZones([]);
        setSelectedZone(null);
      }
    } catch (err) {
      console.error("Error fetching zones:", err);
      console.log("Error details:", err.response ? err.response.data : "No response data");
      Alert.alert("Error", "Failed to fetch zones.");
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  };

  const fetchZoneSensors = async (zoneId) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoading(false);
        return;
      }
      const response = await axios.get(`${API_ENDPOINTS.DEVICES}?zoneId=${zoneId}`, {
        headers: getAuthHeaders(token),
      });
  
      console.log("Devices response:", response.data);
  
      if (Array.isArray(response.data) && response.data.length > 0) {
        const sensorOptions = response.data.map(device => ({
          label: device.name || "Unnamed Sensor",
          value: device._id
        }));
        
        setZoneSensors(sensorOptions);
      } else {
        setZoneSensors([]);
      }
    } catch (err) {
      console.error("Error fetching zone sensors:", err);
      console.log("Error details:", err.response ? err.response.data : "No response data");
      Alert.alert("Error", "Failed to fetch sensors for this zone.");
      setZoneSensors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSensorData = async (start, end) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoading(false);
        return;
      }

      const newData = {};
      let maxPoints = 0;

      for (const sensorId of selectedSensors) {
        const response = await fetch(
          `${API_ENDPOINTS.SENSOR_DATA}?sensorId=${sensorId}&startDate=${start}&endDate=${end}`, 
          {
            headers: getAuthHeaders(token),
          }
        );

        const result = await response.json();
        if (response.ok && result.data && Array.isArray(result.data)) {
          const sortedData = result.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const sensorName = zoneSensors.find(s => s.value === sensorId)?.label || sensorId;
          newData[sensorId] = {
            name: sensorName,
            data: sortedData
          };
          
          if (sortedData.length > maxPoints) {
            maxPoints = sortedData.length;
          }
        }
      }
      
      setData(newData);
      setMaxDataPoints(maxPoints);
    } catch (err) {
      console.error("Network error:", err);
      Alert.alert("Error", "Failed to fetch sensor data.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPress = async () => {
    if (Object.keys(data).length === 0) {
      Alert.alert("Error", "No data available to export.");
      return;
    }

    let htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; }
            h2 { color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .sensor-header { background-color: #e6f2ff; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <h1>Sensor Data Report</h1>
          <p>Zone: ${zones.find(z => z.value === selectedZone)?.label || 'Unknown'}</p>
          <p>Date Range: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
    `;

    for (const sensorId in data) {
      const sensorData = data[sensorId];
      
      htmlContent += `
        <h2>Sensor: ${sensorData.name}</h2>
        <table>
          <tr>
            <th>Timestamp</th>
            ${selectedMetrics.includes("Temperature") ? "<th>Temperature (°C)</th>" : ""}
            ${selectedMetrics.includes("Humidity") ? "<th>Humidity (%)</th>" : ""}
            ${selectedMetrics.includes("Dew Point") ? "<th>Dew Point (°C)</th>" : ""}
            ${selectedMetrics.includes("VPO") ? "<th>VPO</th>" : ""}
          </tr>
          ${sensorData.data.map(item => `
            <tr>
              <td>${new Date(item.timestamp).toLocaleString('th-TH')}</td>
              ${selectedMetrics.includes("Temperature") ? `<td>${item.temperature || "N/A"}</td>` : ""}
              ${selectedMetrics.includes("Humidity") ? `<td>${item.humidity || "N/A"}</td>` : ""}
              ${selectedMetrics.includes("Dew Point") ? `<td>${item.dew_point || "N/A"}</td>` : ""}
              ${selectedMetrics.includes("VPO") ? `<td>${item.vpo || "N/A"}</td>` : ""}
            </tr>
          `).join('')}
        </table>
      `;
    }

    htmlContent += `
          <div class="footer">Generated on ${formatDate(new Date())} ${formatTime(new Date())}</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF Report',
        UTI: 'com.adobe.pdf',
      });

      Alert.alert("Success", "PDF exported successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to export PDF: " + error.message);
    }
  };

  const toggleMetric = (metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const onStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempStartDate;
    setTempStartDate(currentDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempEndDate;
    setTempEndDate(currentDate);
  };

  const confirmStartDate = () => {
    setStartDate(tempStartDate);
    setShowStartPicker(false);
    setShowEndPicker(true);
  };

  const confirmEndDate = () => {
    setEndDate(tempEndDate);
    setShowEndPicker(false);
  };

  const cancelPicker = () => {
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

const prepareChartData = () => {
  let allTimestamps = [];
  Object.values(data).forEach(sensorData => {
    sensorData.data.forEach(item => {
      allTimestamps.push(item.timestamp);
    });
  });
  
  allTimestamps = [...new Set(allTimestamps)].sort();
  
  const labels = allTimestamps.map(timestamp => {
    const date = new Date(timestamp);
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    return daysDiff <= 2
      ? date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
  });
  
  const datasets = [];
  
  Object.entries(data).forEach(([sensorId, sensorData], sensorIndex) => {
    const dataByTimestamp = sensorData.data.reduce((acc, item) => {
      acc[item.timestamp] = item;
      return acc;
    }, {});
    
    const sensorColorIndex = sensorIndex % SENSOR_COLORS.length;
    
    if (selectedMetrics.includes("Temperature")) {
      datasets.push({
        data: allTimestamps.map(timestamp => {
          const item = dataByTimestamp[timestamp];
          return item ? item.temperature || 0 : 0;
        }),
        color: (opacity = 1) => {
          switch(sensorColorIndex) {
            case 0: return `rgba(255, 99, 132, ${opacity})`; // #FF6384
            case 1: return `rgba(54, 162, 235, ${opacity})`; // #36A2EB
            case 2: return `rgba(75, 192, 192, ${opacity})`; // #4BC0C0
            case 3: return `rgba(34, 197, 94, ${opacity})`; // #22C55E
            case 4: return `rgba(255, 206, 86, ${opacity})`; // #FFCE56
            case 5: return `rgba(153, 102, 255, ${opacity})`; // #9966FF
            case 6: return `rgba(255, 159, 64, ${opacity})`; // #FF9F40
            case 7: return `rgba(32, 201, 151, ${opacity})`; // #20C997
            case 8: return `rgba(108, 117, 125, ${opacity})`; // #6C757D
            case 9: return `rgba(253, 126, 20, ${opacity})`; // #FD7E14
            default: return `rgba(0, 0, 0, ${opacity})`;
          }
        },
        strokeWidth: 2,
        withDots: true,
        sensorName: sensorData.name,
        metric: "Temperature"
      });
    }
    
    if (selectedMetrics.includes("Humidity")) {
      datasets.push({
        data: allTimestamps.map(timestamp => {
          const item = dataByTimestamp[timestamp];
          return item ? item.humidity || 0 : 0;
        }),
        color: (opacity = 1) => {
          switch(sensorColorIndex) {
            case 0: return `rgba(215, 59, 92, ${opacity})`; // Darker #FF6384
            case 1: return `rgba(14, 122, 195, ${opacity})`; // Darker #36A2EB
            case 2: return `rgba(35, 152, 152, ${opacity})`; // Darker #4BC0C0
            case 3: return `rgba(0, 157, 54, ${opacity})`; // Darker #22C55E
            case 4: return `rgba(215, 166, 46, ${opacity})`; // Darker #FFCE56
            case 5: return `rgba(113, 62, 215, ${opacity})`; // Darker #9966FF
            case 6: return `rgba(215, 119, 24, ${opacity})`; // Darker #FF9F40
            case 7: return `rgba(0, 161, 111, ${opacity})`; // Darker #20C997
            case 8: return `rgba(68, 77, 85, ${opacity})`; // Darker #6C757D
            case 9: return `rgba(213, 86, 0, ${opacity})`; // Darker #FD7E14
            default: return `rgba(80, 80, 80, ${opacity})`;
          }
        },
        strokeWidth: 2,
        withDots: true,
        dashArray: [5, 5],
        sensorName: sensorData.name,
        metric: "Humidity"
      });
    }
    
    if (selectedMetrics.includes("Dew Point")) {
      datasets.push({
        data: allTimestamps.map(timestamp => {
          const item = dataByTimestamp[timestamp];
          return item ? item.dew_point || 0 : 0;
        }),
        color: (opacity = 1) => {
          switch(sensorColorIndex) {
            case 0: return `rgba(255, 139, 172, ${opacity})`; // Lighter #FF6384
            case 1: return `rgba(94, 202, 255, ${opacity})`; // Lighter #36A2EB
            case 2: return `rgba(115, 232, 232, ${opacity})`; // Lighter #4BC0C0
            case 3: return `rgba(74, 237, 134, ${opacity})`; // Lighter #22C55E
            case 4: return `rgba(255, 246, 126, ${opacity})`; // Lighter #FFCE56
            case 5: return `rgba(193, 142, 255, ${opacity})`; // Lighter #9966FF
            case 6: return `rgba(255, 199, 104, ${opacity})`; // Lighter #FF9F40
            case 7: return `rgba(72, 241, 191, ${opacity})`; // Lighter #20C997
            case 8: return `rgba(148, 157, 165, ${opacity})`; // Lighter #6C757D
            case 9: return `rgba(255, 166, 60, ${opacity})`; // Lighter #FD7E14
            default: return `rgba(180, 180, 180, ${opacity})`;
          }
        },
        strokeWidth: 2,
        withDots: true,
        dashArray: [2, 2],
        sensorName: sensorData.name,
        metric: "Dew Point"
      });
    }

    if (selectedMetrics.includes("VPO")) {
      datasets.push({
        data: allTimestamps.map(timestamp => {
          const item = dataByTimestamp[timestamp];
          return item ? item.vpo || 0 : 0;
        }),
        color: (opacity = 1) => {
          switch(sensorColorIndex) {
            case 0: return `rgba(255, 79, 112, ${opacity})`; // Orange tint #FF6384
            case 1: return `rgba(34, 142, 215, ${opacity})`; // Orange tint #36A2EB
            case 2: return `rgba(35, 172, 172, ${opacity})`; // Orange tint #4BC0C0
            case 3: return `rgba(14, 177, 74, ${opacity})`; // Orange tint #22C55E
            case 4: return `rgba(235, 186, 66, ${opacity})`; // Orange tint #FFCE56
            case 5: return `rgba(133, 82, 235, ${opacity})`; // Orange tint #9966FF
            case 6: return `rgba(235, 139, 60, ${opacity})`; // Orange tint #FF9F40
            case 7: return `rgba(16, 182, 137, ${opacity})`; // Orange tint #20C997
            case 8: return `rgba(88, 97, 105, ${opacity})`; // Orange tint #6C757D
            case 9: return `rgba(233, 106, 0, ${opacity})`; // Orange tint #FD7E14
            default: return `rgba(120, 120, 120, ${opacity})`;
          }
        },
        strokeWidth: 2,
        withDots: true,
        dashArray: [5, 2, 2, 2], 
        sensorName: sensorData.name,
        metric: "VPO"
      });
    }
  });
  
  return {
    labels,
    datasets: datasets.length > 0 ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }]
  };
};

  const chartData = Object.keys(data).length > 0 ? prepareChartData() : {
    labels: ["No Data"],
    datasets: [{ data: [0, 0, 0], color: () => "transparent" }]
  };

  const formatDate = (date) => {
    if (!date) return "";
    const thaiYear = date.getFullYear() + 543;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${thaiYear} BE`;
  };

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString();
  };

  const renderSensorItem = (item) => {
    return (
      <View style={styles.item}>
        <Text style={styles.textItem}>{item.label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t("statistics")}</Text>
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.currentDateText}>
          {t("current_date_and_time")}: {formatDate(currentDate)} {formatTime(currentDate)}
        </Text>

        {/* Zone Selection */}
        <View style={styles.dropdownContainer}>
          {loadingZones ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>{t("loading_zones")}</Text>
            </View>
          ) : zones.length === 0 ? (
            <View style={styles.noDevicesWarning}>
              <Text style={styles.noDeviceText}>{t("No Zones Found Please Add A Zone First")}</Text>
              <TouchableOpacity
                style={styles.addDeviceButton}
                onPress={() => router.push("/features/add-zone")}
              >
                <Text style={styles.addDeviceButtonText}>{t("add_zone")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.dropdownLabel}>{t("Zones")}</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                inputSearchStyle={styles.dropdownInputSearch}
                data={zones}
                search
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={t("select_zone")}
                searchPlaceholder={t("search...")}
                value={selectedZone}
                onChange={(item) => setSelectedZone(item.value)}
              />
            </>
          )}
        </View>

        {/* Sensor Selection (MultiSelect) */}
        {selectedZone && (
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>{t("Sensors")}</Text>
            {zoneSensors.length === 0 ? (
              <View style={styles.noDevicesWarning}>
                <Text style={styles.noDeviceText}>{t("No Sensors In This Zone")}</Text>
              </View>
            ) : (
              <MultiSelect
              style={styles.dropdown}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              inputSearchStyle={styles.dropdownInputSearch}
              data={zoneSensors}
              labelField="label"
              valueField="value"
              placeholder={t("select_sensors")}
              searchPlaceholder={t("search...")}
              value={selectedSensors}
              onChange={item => {
                setSelectedSensors(item);
              }}
              renderItem={(item) => (
                <View style={styles.item}>
                  <Text style={styles.textItem}>{item.label}</Text>
                  {selectedSensors.includes(item.value) && (
                    <FontAwesome5 name="check" size={16} color="#007AFF" />
                  )}
                </View>
              )}
              selectedStyle={styles.selectedStyle}
              renderSelectedItem={(item, unSelect) => (
                <TouchableOpacity onPress={() => unSelect && unSelect(item)}>
                  <View style={styles.selectedItem}>
                    <Text style={styles.selectedText}>{item.label}</Text>
                    <FontAwesome5 name="times" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            />
            )}
          </View>
        )}

        {selectedZone && zoneSensors.length > 0 && (
          <>
            <View style={styles.dateExportContainer}>
              <Text style={styles.dateRangeText}>{t("Select Date Range")}</Text>
              <TouchableOpacity 
                style={styles.exportButton} 
                onPress={handleExportPress} 
                disabled={Object.keys(data).length === 0}
              >
                <FontAwesome5 name="download" size={16} color="#fff" style={styles.exportIcon} />
                <Text style={styles.exportText}>{t("export_data")}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerContainer}>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowStartPicker(true)}
              >
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowEndPicker(true)}
              >
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>

            <Modal visible={showStartPicker} transparent animationType="slide">
              <View style={styles.modalContainer}>
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerTitle}>{t("Select Start Date")}</Text>
                  <DateTimePicker
                    value={tempStartDate}
                    mode="date"
                    display="default"
                    onChange={onStartDateChange}
                  />
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.cancelButton} onPress={cancelPicker}>
                      <Text style={styles.buttonText}>{t("cancel")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={confirmStartDate}>
                      <Text style={styles.buttonText}>{t("confirm")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={showEndPicker} transparent animationType="slide">
              <View style={styles.modalContainer}>
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerTitle}>{t("Select End Date")}</Text>
                  <DateTimePicker
                    value={tempEndDate}
                    mode="date"
                    display="default"
                    onChange={onEndDateChange}
                  />
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.cancelButton} onPress={cancelPicker}>
                      <Text style={styles.buttonText}>{t("cancel")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={confirmEndDate}>
                      <Text style={styles.buttonText}>{t("confirm")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <View style={styles.metricContainer}>
              {["Temperature", "Humidity", "Dew Point", "VPO"].map((metric) => (
                <TouchableOpacity
                  key={metric}
                  onPress={() => toggleMetric(metric)}
                  style={[
                    styles.metricButton,
                    selectedMetrics.includes(metric) && {
                      backgroundColor:
                        metric === "Temperature"
                          ? "#FF6384"
                          : metric === "Humidity"
                          ? "#36A2EB" 
                          : metric === "Dew Point"
                          ? "#4BC0C0"
                          : "#22C55E",
                    },
                  ]}
                >
                  <FontAwesome5
                    name={
                      metric === "Temperature"
                        ? "thermometer-half"
                        : metric === "Humidity"
                        ? "tint"
                        : metric === "Dew Point"
                        ? "cloud"
                        : "wind"
                    }
                    size={14}
                    color="#fff"
                    style={styles.metricIcon}
                  />
                  <Text style={styles.metricText}>{metric}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>{t("Loading Data")}</Text>
              </View>
            ) : Object.keys(data).length === 0 ? (
              <Text style={styles.noDataText}>
                {selectedSensors.length === 0 
                  ? t("Please Select At Least One Sensor") 
                  : t("No Data Available For The Selected Date Range")}
              </Text>
            ) : (
              <View style={styles.chartOuterContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContainer}
                >
                  <LineChart
                    data={chartData}
                    width={Math.max(chartWidth, maxDataPoints * 80)}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: { r: "5", strokeWidth: "2", stroke: "#fff" },
                      propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                      propsForLabels: { fontSize: 10, fontWeight: "bold" },
                      formatYLabel: (value) => value,
                    }}
                    bezier
                    style={styles.chart}
                    withInnerLines={true}
                    withOuterLines={false}
                    withVerticalLines={true}
                    withHorizontalLines={true}
                    withDots={true}
                    withShadow={false}
                    segments={5}
                    fromZero={false}
                    yAxisInterval={5}
                    yAxisSuffix=""
                    yAxisLabel=""
                    legendStyle={styles.chartLegend}
                  />
                </ScrollView>
                
                {/* Enhanced Legend */}
                <View style={styles.legendContainer}>
                  {chartData.datasets.filter(dataset => dataset.sensorName).map((dataset, index) => (
                    <View key={index} style={styles.legendItem}>
                      <View 
                        style={[
                          styles.legendColor, 
                          { 
                            backgroundColor: dataset.color(1),
                            borderStyle: dataset.dashArray ? 'dashed' : 'solid'
                          }
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {dataset.sensorName} - {dataset.metric}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t("swipe_the_graph_horizontally_to_view_more_data")}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: isIOS ? 0 : StatusBar.currentHeight,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    flex: 1,
    textAlign: "left",
  },
  placeholder: {
    width: 44,
  },
  currentDateText: {
    fontSize: 14,
    marginBottom: 16,
    color: "#555",
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  dropdownContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdown: {
    height: 50,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dropdownPlaceholder: {
    color: "#666",
  },
  dropdownSelectedText: {
    color: "#000",
    fontWeight: "500",
  },
  dropdownInputSearch: {
    height: 40,
    fontSize: 16,
  },
  selectedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,  
    marginRight: 8, 
    marginBottom: 8,  
    marginVertical: 4,  
    backgroundColor: "#007AFF",
    borderRadius: 14,
  },
  selectedText: {
    color: "#fff",
    marginRight: 6,
    fontSize: 12,
  },
  selectedStyle: {
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    paddingVertical: 4,
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textItem: {
    fontSize: 14,
  },
  dateExportContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateRangeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#28A745",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportIcon: {
    marginRight: 6,
  },
  exportText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  datePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: {
    fontSize: 13,
  },
  calendarIcon: {
    marginRight: 8,
  },
  metricContainer: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  metricButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
  },
  metricIcon: {
    marginRight: 6,
  },
  metricText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  chartOuterContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  chartScrollContainer: {
    paddingBottom: 10,
  },
  chart: {
    borderRadius: 16,
    marginTop: 8,
  },
  chartLegend: {
    display: "none",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  legendText: {
    fontSize: 11,
    color: "#444",
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#555",
    marginLeft: 8,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 16,
    color: 'gray',
  },
  footer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  noDevicesWarning: {
    alignItems: 'center',
    padding: 10,
  },
  noDeviceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  addDeviceButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addDeviceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
});