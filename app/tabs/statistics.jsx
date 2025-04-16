import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import MultiSelect from 'react-native-multiple-select';
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;
const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

// ฟังก์ชันสุ่มสี
const getRandomColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r}, ${g}, ${b}, 1)`;
};

export default function Statistics() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [startDate, setStartDate] = useState(new Date("2025-04-15T00:00:00Z"));
  const [endDate, setEndDate] = useState(new Date("2025-04-15T23:59:59Z"));
  const [tempStartDate, setTempStartDate] = useState(new Date("2025-04-15T00:00:00Z"));
  const [tempEndDate, setTempEndDate] = useState(new Date("2025-04-15T23:59:59Z"));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(windowWidth * 0.9);
  const [zones, setZones] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [colors, setColors] = useState({});

  useFocusEffect(
    useCallback(() => {
      setSelectedZones([]);
      fetchZones();
      fetchSensors();
      fetchSensorData(startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
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
    if (selectedZones.length > 0 && selectedSensors.length > 0) {
      fetchSensorData(startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
    } else {
      setData([]);
    }
  }, [selectedZones, selectedSensors]);

  useEffect(() => {
    const updateChartWidth = () => {
      const minWidth = windowWidth * 0.9;
      const dataPoints = data.length;
      const calculatedWidth = Math.max(minWidth, dataPoints * 80);
      setChartWidth(calculatedWidth);
    };
    updateChartWidth();
  }, [data.length]);

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
        timeout: API_TIMEOUT
      });

      console.log("📡 Zones Response:", response.data);

      if (response.data && response.data.zones) {
        const userCreatedZones = response.data.zones.filter(zone => !zone.isDefault);
        setZones(userCreatedZones);

        const newColors = {};
        userCreatedZones.forEach(zone => {
          newColors[zone._id] = getRandomColor();
        });
        setColors(newColors);
      } else {
        setZones([]);
      }
    } catch (err) {
      console.error("Error fetching zones:", err);
      Alert.alert("Error", "Failed to fetch zones.");
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  };

  const fetchSensors = async () => {
    try {
      setLoadingSensors(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoadingSensors(false);
        return;
      }

      const response = await axios.get(API_ENDPOINTS.DEVICES, {
        headers: getAuthHeaders(token),
        params: { allZones: true },
      });

      console.log("📡 Sensors Response:", response.data);

      if (Array.isArray(response.data) && response.data.length > 0) {
        const devices = response.data.map(device => ({
          label: device.name,
          value: device.name,
          zoneId: device.zoneId
        }));
        setSensors(devices);

        console.log("📋 Mapped Sensors:", devices);
        console.log("📋 Sensor Zone Mapping:", devices.map(d => ({ name: d.label, zoneId: d.zoneId })));
      } else {
        setSensors([]);
        setSelectedSensors([]);
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching sensors:", err);
      Alert.alert("Error", "Failed to fetch sensors.");
      setSensors([]);
      setSelectedSensors([]);
      setData([]);
    } finally {
      setLoadingSensors(false);
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

      const response = await axios.get(`${API_ENDPOINTS.SENSOR_DATA}?startDate=${start}&endDate=${end}`, {
        headers: getAuthHeaders(token),
      });

      console.log("📡 Sensor Data Response:", response.data);

      const result = response.data;
      if (response.status === 200 && Array.isArray(result.data)) {
        const filteredData = result.data.filter(item => {
          const sensor = sensors.find(s => s.value === item.sensorId);
          return sensor && 
                 (selectedZones.length === 0 || selectedZones.includes(sensor.zoneId)) && 
                 selectedSensors.includes(item.sensorId);
        });

        console.log("📊 Filtered Data:", filteredData);

        const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setData(sortedData);
      } else {
        Alert.alert("Error", result.message || "Failed to fetch sensor data.");
        setData([]);
      }
    } catch (err) {
      console.error("Network error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPress = async () => {
    if (data.length === 0) {
      Alert.alert("Error", "No data available to export.");
      return;
    }

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
          <h1>Sensor Data Report</h1>
          <p>Zones: ${selectedZones.map(zoneId => zones.find(z => z._id === zoneId)?.name).join(", ")}</p>
          <p>Sensors: ${selectedSensors.map(sensorId => sensors.find(s => s.value === sensorId)?.label).join(", ")}</p>
          <p>Metrics: ${selectedMetrics.join(", ")}</p>
          <p>Date Range: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
          <table>
            <tr>
              <th>Timestamp</th>
              ${selectedMetrics.map(metric => `<th>${metric} (${metric === "Humidity" ? "%" : "°C"})</th>`).join('')}
            </tr>
            ${data.map(item => `
              <tr>
                <td>${new Date(item.timestamp).toLocaleString('th-TH')}</td>
                ${selectedMetrics.map(metric => `<td>${item[metric.toLowerCase()] || "N/A"}</td>`).join('')}
              </tr>
            `).join('')}
          </table>
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
    if (selectedMetrics.includes(metric)) {
      setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  const onZoneChange = (selectedItems) => {
    setSelectedZones(selectedItems);
    // ถ้ามีการยกเลิกเลือกโซน ให้ยกเลิกเซ็นเซอร์ที่อยู่ในโซนนั้นด้วย
    setSelectedSensors(prevSensors => {
      return prevSensors.filter(sensorId => {
        const sensor = sensors.find(s => s.value === sensorId);
        return sensor && (selectedItems.length === 0 || selectedItems.includes(sensor.zoneId));
      });
    });
  };

  const onSensorChange = (selectedItems) => {
    setSelectedSensors(selectedItems);
  };

  const onStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempStartDate;
    console.log("Start Date Changed:", currentDate);
    setTempStartDate(currentDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempEndDate;
    console.log("End Date Changed:", currentDate);
    setTempEndDate(currentDate);
  };

  const confirmStartDate = () => {
    console.log("Confirming Start Date:", tempStartDate);
    setStartDate(tempStartDate);
    setShowStartPicker(false);
  };

  const confirmEndDate = () => {
    console.log("Confirming End Date:", tempEndDate);
    setEndDate(tempEndDate);
    if (selectedSensors.length > 0) {
      fetchSensorData(startDate.toISOString().split("T")[0], tempEndDate.toISOString().split("T")[0]);
    }
    setShowEndPicker(false);
  };

  const cancelPicker = () => {
    console.log("Canceling Date Picker");
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const handleWebStartDateChange = (date) => {
    if (date) {
      console.log("Web Start Date Changed:", date);
      setTempStartDate(date);
    }
  };

  const handleWebEndDateChange = (date) => {
    if (date) {
      console.log("Web End Date Changed:", date);
      setTempEndDate(date);
    }
  };

  const chartData = {
    labels: data.length > 0
      ? data.map((item) => {
          const date = new Date(item.timestamp);
          return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        })
      : ["00:00"],
    datasets: selectedMetrics.length > 0
      ? selectedMetrics.flatMap(metric => {
          return selectedSensors.map(sensorId => {
            const sensor = sensors.find(s => s.value === sensorId);
            const sensorData = data.filter(item => item.sensorId === sensorId);
            console.log(`📊 Sensor ${sensor.label} Data for ${metric}:`, sensorData);
            return {
              data: sensorData.length > 0
                ? sensorData
                    .filter(item => item[metric.toLowerCase()] !== null)
                    .map(item => item[metric.toLowerCase()])
                : [0],
              color: () => colors[sensor.zoneId] || "rgba(0, 0, 0, 1)",
              strokeWidth: 3,
              label: `${sensor.label} - ${metric}`,
            };
          }).filter(dataset => dataset.data.length > 0 && dataset.data.some(value => value !== 0));
        })
      : [],
  };

  const finalData = chartData.datasets.length > 0 && data.length > 0
    ? chartData
    : {
        labels: ["00:00"],
        datasets: [{ data: [0], color: () => "transparent" }],
      };

  console.log("📈 Final Chart Data:", finalData);

  const formatDate = (date) => {
    if (!date) return "";
    const thaiYear = date.getFullYear() + 543;
    return `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleString('th-TH', { month: 'long' })} ${thaiYear}`;
  };

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString();
  };

  const zonesData = zones.map(zone => ({
    id: zone._id,
    name: zone.name,
  }));

  // กรองเซ็นเซอร์ตามโรงเรือนที่เลือก ถ้าไม่เลือกโรงเรือนใดเลย ให้แสดงเซ็นเซอร์ทั้งหมด
  const sensorsData = sensors
    .filter(sensor => selectedZones.length === 0 || selectedZones.includes(sensor.zoneId))
    .map(sensor => ({
      id: sensor.value,
      name: sensor.label,
    }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerContainer}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("statistics")}</Text>
          <Pressable style={styles.exportButton} onPress={handleExportPress} disabled={data.length === 0}>
            <Ionicons name="ellipsis-vertical" size={24} color="black" />
          </Pressable>
        </View>

        <View style={styles.metricContainer}>
          {["Temperature", "Humidity", "Dew Point"].map((metric) => (
            <Pressable
              key={metric}
              onPress={() => toggleMetric(metric)}
              style={[
                styles.metricButton,
                selectedMetrics.includes(metric) && {
                  backgroundColor:
                    metric === "Temperature" ? "#FF6384" :
                    metric === "Humidity" ? "#36A2EB" :
                    "#4BC0C0",
                },
              ]}
            >
              <FontAwesome5
                name={
                  metric === "Temperature" ? "thermometer-half" :
                  metric === "Humidity" ? "tint" :
                  "cloud"
                }
                size={14}
                color="#fff"
                style={styles.metricIcon}
              />
              <Text style={styles.metricText}>{metric}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.currentDateText}>
          {formatDate(currentDate)}
        </Text>

        <View style={styles.dropdownContainer}>
          {loadingZones ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>{t("loading_zones")}</Text>
            </View>
          ) : zones.length === 0 ? (
            <View style={styles.noDevicesWarning}>
              <Text style={styles.noDeviceText}>{t("no_zones_please_add_a_zone_first")}</Text>
              <Pressable
                style={styles.addDeviceButton}
                onPress={() => router.push("/features/add-zone")}
              >
                <Text style={styles.addDeviceButtonText}>{t("add_zone")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.dropdownLabel}>โรงเรือน</Text>
              <MultiSelect
                items={zonesData}
                uniqueKey="id"
                onSelectedItemsChange={onZoneChange}
                selectedItems={selectedZones}
                selectText="เลือกโรงเรือน"
                searchInputPlaceholderText="ค้นหาโรงเรือน..."
                onChangeInput={(text) => console.log(text)}
                tagRemoveIconColor="#CCC"
                tagBorderColor="#CCC"
                tagTextColor="#CCC"
                selectedItemTextColor="#CCC"
                selectedItemIconColor="#CCC"
                itemTextColor="#000"
                displayKey="name"
                searchInputStyle={styles.dropdownInputSearch}
                submitButtonColor="#007AFF"
                submitButtonText="เลือก"
                styleDropdownMenu={styles.dropdown}
                styleDropdownMenuSubsection={styles.dropdownSubsection}
                styleTextDropdownSelected={styles.dropdownSelectedText}
              />
            </>
          )}
        </View>

        {zones.length > 0 && (
          <View style={styles.dropdownContainer}>
            {loadingSensors ? (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>{t("loading_sensors")}</Text>
              </View>
            ) : sensors.length === 0 ? (
              <View style={styles.noDevicesWarning}>
                <Text style={styles.noDeviceText}>{t("no_sensors_please_add_a_sensor_first")}</Text>
                <Pressable
                  style={styles.addDeviceButton}
                  onPress={() => router.push({
                    pathname: "/devices/selectdevice",
                    params: { returnTo: "statistics" }
                  })}
                >
                  <Text style={styles.addDeviceButtonText}>{t("add_sensor")}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.dropdownLabel}>เซ็นเซอร์</Text>
                <MultiSelect
                  items={sensorsData}
                  uniqueKey="id"
                  onSelectedItemsChange={onSensorChange}
                  selectedItems={selectedSensors}
                  selectText="เลือกเซ็นเซอร์"
                  searchInputPlaceholderText="ค้นหาเซ็นเซอร์..."
                  onChangeInput={(text) => console.log(text)}
                  tagRemoveIconColor="#CCC"
                  tagBorderColor="#CCC"
                  tagTextColor="#CCC"
                  selectedItemTextColor="#CCC"
                  selectedItemIconColor="#CCC"
                  itemTextColor="#000"
                  displayKey="name"
                  searchInputStyle={styles.dropdownInputSearch}
                  submitButtonColor="#007AFF"
                  submitButtonText="เลือก"
                  styleDropdownMenu={styles.dropdown}
                  styleDropdownMenuSubsection={styles.dropdownSubsection}
                  styleTextDropdownSelected={styles.dropdownSelectedText}
                />
              </>
            )}
          </View>
        )}

        {sensors.length > 0 && (
          <>
            <View style={styles.dateExportContainer}>
              <Text style={styles.dateRangeText}>SELECT DATE RANGE</Text>
            </View>

            <View style={styles.datePickerContainer}>
              <Pressable
                style={styles.datePickerButton}
                onPress={() => {
                  console.log("Opening Start Date Picker");
                  setShowStartPicker(true);
                }}
              >
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              </Pressable>
              <Pressable
                style={styles.datePickerButton}
                onPress={() => {
                  console.log("Opening End Date Picker");
                  setShowEndPicker(true);
                }}
              >
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              </Pressable>
            </View>

            <Modal visible={showStartPicker} transparent animationType="slide">
              {console.log("Start Picker Modal Visible:", showStartPicker)}
              <View style={styles.modalContainer}>
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerTitle}>{t("select_start_date")}</Text>
                  {isWeb ? (
                    <>
                      <DatePicker
                        selected={tempStartDate}
                        onChange={handleWebStartDateChange}
                        dateFormat="dd/MM/yyyy"
                        className="react-datepicker-wrapper"
                        popperPlacement="bottom"
                        inline={false}
                        showYearDropdown
                        dropdownMode="select"
                      />
                      <View style={styles.buttonContainer}>
                        <Pressable style={styles.cancelButton} onPress={cancelPicker}>
                          <Text style={styles.buttonText}>{t("cancel")}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmButton} onPress={confirmStartDate}>
                          <Text style={styles.buttonText}>{t("confirm")}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <DateTimePicker
                        value={tempStartDate}
                        mode="date"
                        display="default"
                        onChange={onStartDateChange}
                      />
                      <View style={styles.buttonContainer}>
                        <Pressable style={styles.cancelButton} onPress={cancelPicker}>
                          <Text style={styles.buttonText}>{t("cancel")}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmButton} onPress={confirmStartDate}>
                          <Text style={styles.buttonText}>{t("confirm")}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>

            <Modal visible={showEndPicker} transparent animationType="slide">
              {console.log("End Picker Modal Visible:", showEndPicker)}
              <View style={styles.modalContainer}>
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerTitle}>{t("select_end_date")}</Text>
                  {isWeb ? (
                    <>
                      <DatePicker
                        selected={tempEndDate}
                        onChange={handleWebEndDateChange}
                        dateFormat="dd/MM/yyyy"
                        className="react-datepicker-wrapper"
                        popperPlacement="bottom"
                        inline={false}
                        showYearDropdown
                        dropdownMode="select"
                      />
                      <View style={styles.buttonContainer}>
                        <Pressable style={styles.cancelButton} onPress={cancelPicker}>
                          <Text style={styles.buttonText}>{t("cancel")}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmButton} onPress={confirmEndDate}>
                          <Text style={styles.buttonText}>{t("confirm")}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <DateTimePicker
                        value={tempEndDate}
                        mode="date"
                        display="default"
                        onChange={onEndDateChange}
                      />
                      <View style={styles.buttonContainer}>
                        <Pressable style={styles.cancelButton} onPress={cancelPicker}>
                          <Text style={styles.buttonText}>{t("cancel")}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmButton} onPress={confirmEndDate}>
                          <Text style={styles.buttonText}>{t("confirm")}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>{t("loading_data")}</Text>
              </View>
            ) : data.length === 0 ? (
              <Text style={styles.noDataText}>
                {t("no_data_available_for_the_selected_date_range.")}
              </Text>
            ) : selectedMetrics.length === 0 ? (
              <Text style={styles.noDataText}>
                {t("please_select_at_least_one_metric.")}
              </Text>
            ) : finalData.datasets.length === 0 ? (
              <Text style={styles.noDataText}>
                {t("no_matching_data_for_selected_zones_or_sensors.")}
              </Text>
            ) : (
              <View style={styles.chartOuterContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContainer}
                >
                  <LineChart
                    data={finalData}
                    width={Math.max(chartWidth, (finalData.labels.length || 1) * 80)}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#f8f9fa",
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: { r: "5", strokeWidth: "2", stroke: "#fff" },
                      propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                      propsForLabels: { fontSize: 11, fontWeight: "bold" },
                      formatYLabel: (value) => value,
                    }}
                    bezier
                    style={styles.chart}
                    withInnerLines={true}
                    withOuterLines={true}
                    withVerticalLabels={true}
                    withHorizontalLabels={true}
                    withDots={true}
                    withShadow={false}
                    segments={5}
                    fromZero={false}
                    yAxisInterval={5}
                    yAxisSuffix=""
                    yAxisLabel=""
                    legendStyle={styles.chartLegend}
                    onDataPointClick={() => {}}
                  />
                </ScrollView>
                <View style={styles.legendContainer}>
                  {selectedZones.map(zoneId => {
                    const zone = zones.find(z => z._id === zoneId);
                    const zoneSensors = sensors.filter(sensor => sensor.zoneId === zoneId && selectedSensors.includes(sensor.value));
                    if (zoneSensors.length === 0) return null;
                    return (
                      <View key={zone._id} style={styles.legendItem}>
                        <Text style={styles.legendZoneText}>{zone.name}</Text>
                        {zoneSensors.map(sensor => (
                          selectedMetrics.map(metric => {
                            const sensorData = data.filter(item => item.sensorId === sensor.value);
                            if (sensorData.length === 0) return null;
                            return (
                              <View key={`${sensor.value}-${metric}`} style={styles.legendSubItems}>
                                <View style={[styles.legendColor, { backgroundColor: colors[sensor.zoneId] }]} />
                                <Text style={styles.legendText}>{`${sensor.label} - ${metric}`}</Text>
                              </View>
                            );
                          })
                        ))}
                      </View>
                    );
                  })}
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
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  exportButton: {
    padding: 5,
  },
  currentDateText: {
    fontSize: 16,
    marginBottom: 16,
    color: "#555",
  },
  dropdownContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    elevation: 2,
    minHeight: 66,
    justifyContent: 'center',
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  dropdown: {
    borderRadius: 10,
  },
  dropdownSubsection: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  dropdownSelectedText: {
    color: "#000",
    fontWeight: "500",
  },
  dropdownInputSearch: {
    height: 40,
    fontSize: 16,
  },
  dateExportContainer: {
    marginBottom: 12,
  },
  dateRangeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  datePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    zIndex: 10,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
    elevation: 2,
    zIndex: 1,
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
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
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
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    marginHorizontal: 10,
    marginBottom: 5,
  },
  legendZoneText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  legendSubItems: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
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
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
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