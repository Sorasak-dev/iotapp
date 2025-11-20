import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MultiSelect } from "react-native-element-dropdown";
import { FontAwesome5 } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from "../utils/config/api";

const windowWidth = Dimensions.get("window").width;
const isIOS = Platform.OS === "ios";

// ปรับสีให้ชัดเจนและแตกต่างกันมากขึ้น
const SENSOR_COLORS = [
  "#E91E63", "#2196F3", "#00BCD4", "#4CAF50", "#FF9800",
  "#9C27B0", "#FF5722", "#009688", "#795548", "#F44336",
];

export default function Statistics() {
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedMetrics, setSelectedMetrics] = useState(["Temperature", "Humidity", "Dew Point", "VPD"]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [chartMode, setChartMode] = useState("separated"); // "separated" หรือ "combined"

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
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedZones.length > 0) {
      fetchSensorsForAllSelectedZones();
      setSelectedSensors([]);
      setData({});
    } else {
      setZoneSensors([]);
    }
  }, [selectedZones]);

  useEffect(() => {
    if (selectedSensors.length > 0) {
      fetchSensorData(
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      );
    } else {
      setData({});
    }
  }, [selectedSensors, startDate, endDate]);

  useEffect(() => {
    const minWidth = windowWidth * 0.9;
    setChartWidth(Math.max(minWidth, maxDataPoints * 80));
  }, [maxDataPoints]);

  const fetchZones = async () => {
    try {
      setLoadingZones(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoadingZones(false);
        return;
      }
      const res = await axios.get(API_ENDPOINTS.ZONES, { headers: getAuthHeaders(token) });

      let zonesData = [];
      if (res.data?.zones && Array.isArray(res.data.zones)) {
        zonesData = res.data.zones.filter((z) => !z.isDefault);
      } else if (Array.isArray(res.data)) {
        zonesData = res.data.filter((z) => !z.isDefault);
      }

      if (zonesData.length) {
        const opts = zonesData.map((z) => ({ label: z.name || "Unnamed Zone", value: z._id || z.id }));
        setZones(opts);
        if (res.data?.currentZoneId) {
          const current = zonesData.find((z) => z._id === res.data.currentZoneId);
          if (current) setSelectedZones([current._id]);
        }
      } else {
        setZones([]);
        setSelectedZones([]);
      }
    } catch (e) {
      console.error("fetchZones", e);
      Alert.alert("Error", "Failed to fetch zones.");
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  };

  const fetchSensorsForAllSelectedZones = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in again.");
        setLoading(false);
        return;
      }
      let all = [];
      for (const zoneId of selectedZones) {
        try {
          const res = await axios.get(`${API_ENDPOINTS.DEVICES}?zoneId=${zoneId}`, {
            headers: getAuthHeaders(token),
          });
          if (Array.isArray(res.data) && res.data.length) {
            const zoneName = zones.find((z) => z.value === zoneId)?.label || "Unknown Zone";
            all = [
              ...all,
              ...res.data.map((d) => ({
                label: `${zoneName} - ${d.name || "Unnamed Sensor"}`,
                value: d._id,
                zoneId,
                zoneName,
              })),
            ];
          }
        } catch (err) {
          console.log("fetch sensors zone", zoneId, err?.message);
        }
      }
      setZoneSensors(all);
    } catch (e) {
      console.error("fetchSensorsForAllSelectedZones", e);
      Alert.alert("Error", "Failed to fetch sensors for selected zones.");
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
      let maxPts = 0;

      for (const sensorId of selectedSensors) {
        try {
          const res = await axios.get(
            `${API_ENDPOINTS.DEVICES}/${sensorId}/data?startDate=${start}&endDate=${end}&limit=1000`,
            { headers: getAuthHeaders(token), timeout: API_TIMEOUT }
          );
          if (res.data?.data && Array.isArray(res.data.data)) {
            const sorted = res.data.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const name = zoneSensors.find((s) => s.value === sensorId)?.label || sensorId;
            newData[sensorId] = { name, data: sorted };
            if (sorted.length > maxPts) maxPts = sorted.length;
          }
        } catch (deviceError) {
          console.log("fetch device data", sensorId, deviceError?.message);
        }
      }

      setData(newData);
      setMaxDataPoints(maxPts);
    } catch (e) {
      console.error("fetchSensorData", e);
      Alert.alert("Error", "Failed to fetch sensor data.");
    } finally {
      setLoading(false);
    }
  };

const openStartPicker = () => {
  if (Platform.OS === "web") {
    Alert.alert("Not supported on Web", "Please run on Android or iOS.");
    return;
  }
  if (loading) return;
  setTempStartDate(startDate || new Date());
  setShowStartPicker(true);
};

const openEndPicker = () => {
  if (Platform.OS === "web") {
    Alert.alert("Not supported on Web", "Please run on Android or iOS.");
    return;
  }
  if (loading) return;
  setTempEndDate(endDate || new Date());
  setShowEndPicker(true);
};

 const onConfirmStart = (date) => {
  setShowStartPicker(false);
  setTempStartDate(date);

  if (endDate && date > endDate) {
    setStartDate(date);
    setEndDate(date);
    setTempEndDate(date);
  } else {
    setStartDate(date);
  }
};

const onConfirmEnd = (date) => {
  setShowEndPicker(false);
  setTempEndDate(date);

  if (startDate && date < startDate) {
    setEndDate(date);
    setStartDate(date);
    setTempStartDate(date);
  } else {
    setEndDate(date);
  }
};

  const prepareChartDataByMetric = () => {
    let allTs = [];
    Object.values(data).forEach((s) => s.data.forEach((it) => allTs.push(it.timestamp)));
    allTs = [...new Set(allTs)].sort();

    const labels = allTs.map((ts) => {
      const d = new Date(ts);
      const days =
        Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
      return days <= 2
        ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    });

    // สีสำหรับแต่ละ sensor
    const sensorColors = [
      "#E91E63", "#2196F3", "#00BCD4", "#4CAF50", "#FF9800",
      "#9C27B0", "#FF5722", "#009688", "#795548", "#F44336",
    ];

    // สร้างกราฟแยกตาม metric
    const chartsByMetric = {};

    selectedMetrics.forEach((metric) => {
      const datasets = [];
      let dataKey = '';
      
      if (metric === "Temperature") {
        dataKey = 'temperature';
      } else if (metric === "Humidity") {
        dataKey = 'humidity';
      } else if (metric === "Dew Point") {
        dataKey = 'dew_point';
      } else if (metric === "VPD") {
        dataKey = 'vpd';
      }

      if (dataKey) {
        Object.entries(data).forEach(([_, sensorData], sensorIndex) => {
          const map = sensorData.data.reduce((acc, it) => ((acc[it.timestamp] = it), acc), {});
          const color = sensorColors[sensorIndex % sensorColors.length];
          
          datasets.push({
            data: allTs.map((ts) => map[ts]?.[dataKey] ?? 0),
            color: () => color,
            strokeWidth: 3,
            withDots: true,
            sensorName: sensorData.name,
            metric: metric,
          });
        });

        chartsByMetric[metric] = {
          labels,
          datasets: datasets.length ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }],
        };
      }
    });

    return chartsByMetric;
  };

  const prepareCombinedChartData = () => {
    let allTs = [];
    Object.values(data).forEach((s) => s.data.forEach((it) => allTs.push(it.timestamp)));
    allTs = [...new Set(allTs)].sort();

    const labels = allTs.map((ts) => {
      const d = new Date(ts);
      const days =
        Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
      return days <= 2
        ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    });

    const sensorColors = [
      "#E91E63", "#2196F3", "#00BCD4", "#4CAF50", "#FF9800",
      "#9C27B0", "#FF5722", "#009688", "#795548", "#F44336",
    ];

    // สีสำหรับแต่ละ metric
    const metricColors = {
      "Temperature": "#E91E63",    // ชมพู
      "Humidity": "#2196F3",        // น้ำเงิน
      "Dew Point": "#00BCD4",       // ฟ้า
      "VPD": "#4CAF50"              // เขียว
    };

    const datasets = [];
    let datasetIndex = 0;

    Object.entries(data).forEach(([_, sensorData], sensorIndex) => {
      const map = sensorData.data.reduce((acc, it) => ((acc[it.timestamp] = it), acc), {});

      selectedMetrics.forEach((metric) => {
        let dataKey = '';
        if (metric === "Temperature") dataKey = 'temperature';
        else if (metric === "Humidity") dataKey = 'humidity';
        else if (metric === "Dew Point") dataKey = 'dew_point';
        else if (metric === "VPD") dataKey = 'vpd';

        if (dataKey) {
          // ใช้สีจาก metricColors แทนสี sensor
          const baseColor = metricColors[metric];
          
          // ถ้ามีหลาย sensor ให้ปรับความเข้มของสี
          const adjustColor = (hexColor, sensorIdx, totalSensors) => {
            if (totalSensors === 1) return hexColor;
            
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // ปรับความเข้มของสีตามลำดับ sensor (เข้มขึ้น/อ่อนลง)
            const factor = 1 - (sensorIdx * 0.2);
            const newR = Math.round(r * factor);
            const newG = Math.round(g * factor);
            const newB = Math.round(b * factor);
            
            return `rgb(${newR}, ${newG}, ${newB})`;
          };

          const color = adjustColor(baseColor, sensorIndex, Object.keys(data).length);
          
          datasets.push({
            data: allTs.map((ts) => map[ts]?.[dataKey] ?? 0),
            color: () => color,
            strokeWidth: 3,
            withDots: true,
            sensorName: sensorData.name,
            metric: metric,
          });
          datasetIndex++;
        }
      });
    });

    return {
      labels,
      datasets: datasets.length ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }],
    };
  };

  const chartDataByMetric = useMemo(() => {
    if (Object.keys(data).length === 0) return {};
    return prepareChartDataByMetric();
  }, [data, selectedMetrics, startDate, endDate]);

  const combinedChartData = useMemo(() => {
    if (Object.keys(data).length === 0) return { labels: ["No Data"], datasets: [{ data: [0, 0, 0], color: () => "transparent" }] };
    return prepareCombinedChartData();
  }, [data, selectedMetrics, startDate, endDate]);

  const formatDate = (date) => {
    if (!date) return "";
    const thaiYear = date.getFullYear() + 543;
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}/${thaiYear} BE`;
  };
  const formatTime = (date) => (date ? date.toLocaleTimeString() : "");

  const toggleMetric = (metric) => {
    setSelectedMetrics((prev) => (prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]));
  };

  const renderZoneItem = (item) => (
    <View style={styles.item}>
      <Text style={styles.textItem}>{item.label}</Text>
      {selectedZones.includes(item.value) && <FontAwesome5 name="check" size={16} color="#007AFF" />}
    </View>
  );
  const renderSensorItem = (item) => (
    <View style={styles.item}>
      <Text style={styles.textItem}>{item.label}</Text>
      {selectedSensors.includes(item.value) && <FontAwesome5 name="check" size={16} color="#007AFF" />}
    </View>
  );

  const goToExport = () => {
    if (selectedSensors.length === 0) {
      Alert.alert("Please select at least one sensor");
      return;
    }
    const sensorPayload = selectedSensors.map((id) => ({
      id,
      name: zoneSensors.find((s) => s.value === id)?.label || id,
    }));
    const zonePayload = selectedZones.map((zid) => ({
      id: zid,
      name: zones.find((z) => z.value === zid)?.label || zid,
    }));

    router.push({
      pathname: "/exportdata",
      params: {
        sensors: JSON.stringify(sensorPayload),
        zones: JSON.stringify(zonePayload),
        metrics: JSON.stringify(selectedMetrics),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t("statistics")}</Text>
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.currentDateText}>
          {t("current_date_and_time")}: {formatDate(currentDate)} {formatTime(currentDate)}
        </Text>

        {/* Zone select */}
        <View style={styles.dropdownContainer}>
          {loadingZones ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>{t("loading_zones")}</Text>
            </View>
          ) : zones.length === 0 ? (
            <View style={styles.noDevicesWarning}>
              <Text style={styles.noDeviceText}>{t("No Zones Found Please Add A Zone First")}</Text>
              <TouchableOpacity style={styles.addDeviceButton} onPress={() => router.push("/features/add-zone")}>
                <Text style={styles.addDeviceButtonText}>{t("add_zone")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.dropdownLabel}>{t("Zones")}</Text>
              <MultiSelect
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                inputSearchStyle={styles.dropdownInputSearch}
                data={zones}
                search
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={t("select_zones")}
                searchPlaceholder={t("search...")}
                value={selectedZones}
                onChange={setSelectedZones}
                renderItem={renderZoneItem}
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
            </>
          )}
        </View>

        {/* Sensor select */}
        {selectedZones.length > 0 && (
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>{t("Sensors")}</Text>
            {zoneSensors.length === 0 ? (
              <View style={styles.noDevicesWarning}>
                <Text style={styles.noDeviceText}>{t("No Sensors In Selected Zones")}</Text>
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
                onChange={setSelectedSensors}
                renderItem={renderSensorItem}
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

        {selectedZones.length > 0 && zoneSensors.length > 0 && (
          <>
            <View style={styles.dateExportContainer}>
              <Text style={styles.dateRangeText}>{t("Select Date Range")}</Text>

              <TouchableOpacity style={styles.exportButton} onPress={goToExport}>
                <FontAwesome5 name="external-link-alt" size={16} color="#fff" style={styles.exportIcon} />
                <Text style={styles.exportText}>Export Data</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerContainer}>
              <TouchableOpacity style={styles.datePickerButton} onPress={openStartPicker}>
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.datePickerButton} onPress={openEndPicker}>
                <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>

            <DateTimePickerModal
              isVisible={showStartPicker}
              mode="date"
              date={tempStartDate}
              onConfirm={onConfirmStart}
              onCancel={() => setShowStartPicker(false)}
              maximumDate={endDate ? new Date(endDate) : undefined}
            />

            <DateTimePickerModal
              isVisible={showEndPicker}
              mode="date"
              date={tempEndDate}
              onConfirm={onConfirmEnd}
              onCancel={() => setShowEndPicker(false)}
              minimumDate={startDate ? new Date(startDate) : undefined}
            />

            {/* Metric toggles */}
            <View style={styles.metricContainer}>
              {["Temperature", "Humidity", "Dew Point", "VPD"].map((metric) => (
                <TouchableOpacity
                  key={metric}
                  onPress={() => toggleMetric(metric)}
                  style={[
                    styles.metricButton,
                    selectedMetrics.includes(metric) && {
                      backgroundColor:
                        metric === "Temperature"
                          ? "#E91E63"
                          : metric === "Humidity"
                          ? "#2196F3"
                          : metric === "Dew Point"
                          ? "#00BCD4"
                          : "#4CAF50",
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

            {/* Chart Mode Toggle */}
            <View style={styles.chartModeContainer}>
              <TouchableOpacity
                style={[styles.modeButton, chartMode === "separated" && styles.modeButtonActive]}
                onPress={() => setChartMode("separated")}
              >
                <FontAwesome5 name="list" size={14} color={chartMode === "separated" ? "#fff" : "#666"} />
                <Text style={[styles.modeButtonText, chartMode === "separated" && styles.modeButtonTextActive]}>
                  Separated
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, chartMode === "combined" && styles.modeButtonActive]}
                onPress={() => setChartMode("combined")}
              >
                <FontAwesome5 name="chart-line" size={14} color={chartMode === "combined" ? "#fff" : "#666"} />
                <Text style={[styles.modeButtonText, chartMode === "combined" && styles.modeButtonTextActive]}>
                  Combined
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chart */}
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
            ) : chartMode === "separated" ? (
              <>
                {selectedMetrics.map((metric) => {
                  const chartData = chartDataByMetric[metric];
                  if (!chartData) return null;

                  return (
                    <View key={metric} style={styles.chartOuterContainer}>
                      <Text style={styles.chartTitle}>{metric}</Text>
                      
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chartScrollContainer}
                      >
                        <LineChart
                          data={chartData}
                          width={chartWidth}
                          height={220}
                          chartConfig={{
                            backgroundColor: "#ffffff",
                            backgroundGradientFrom: "#ffffff",
                            backgroundGradientTo: "#ffffff",
                            decimalPlaces: 1,
                            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            style: { borderRadius: 16 },
                            propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
                            propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                            propsForLabels: { fontSize: 10, fontWeight: "bold" },
                          }}
                          bezier
                          style={styles.chart}
                          withInnerLines
                          withOuterLines={false}
                          withVerticalLines
                          withHorizontalLines
                          withDots
                          withShadow={false}
                          segments={5}
                        />
                      </ScrollView>

                      <View style={styles.legendContainer}>
                        {chartData.datasets
                          .filter((d) => d.sensorName)
                          .map((d, i) => (
                            <View key={i} style={styles.legendItem}>
                              <View
                                style={[
                                  styles.legendColor,
                                  { backgroundColor: d.color(1) },
                                ]}
                              />
                              <Text style={styles.legendText}>
                                {d.sensorName}
                              </Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.chartOuterContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContainer}
                >
                  <LineChart
                    data={combinedChartData}
                    width={chartWidth}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
                      propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                      propsForLabels: { fontSize: 10, fontWeight: "bold" },
                    }}
                    bezier
                    style={styles.chart}
                    withInnerLines
                    withOuterLines={false}
                    withVerticalLines
                    withHorizontalLines
                    withDots
                    withShadow={false}
                    segments={5}
                  />
                </ScrollView>

                <View style={styles.legendContainer}>
                  {combinedChartData.datasets
                    .filter((d) => d.sensorName)
                    .map((d, i) => (
                      <View key={i} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendColor,
                            { backgroundColor: d.color(1) },
                          ]}
                        />
                        <Text style={styles.legendText}>
                          {d.sensorName} - {d.metric}
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
  safeArea: { flex: 1, backgroundColor: "#F8FAFC", paddingTop: isIOS ? 0 : StatusBar.currentHeight },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 50 },
  headerContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: "bold", flex: 1, textAlign: "left" },
  placeholder: { width: 44 },
  currentDateText: { fontSize: 14, marginBottom: 16, color: "#555" },
  dropdownLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#333" },
  dropdownContainer: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  dropdown: { height: 50, backgroundColor: "#f9f9f9", borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: "#e0e0e0" },
  dropdownPlaceholder: { color: "#666" },
  dropdownSelectedText: { color: "#000", fontWeight: "500" },
  dropdownInputSearch: { height: 40, fontSize: 16 },
  selectedItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8, marginRight: 8, marginBottom: 8, marginVertical: 4,
    backgroundColor: "#007AFF", borderRadius: 14,
  },
  selectedText: { color: "#fff", marginRight: 6, fontSize: 12 },
  selectedStyle: { borderRadius: 10, backgroundColor: "#f0f0f0", paddingVertical: 4 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#e0e0e0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  textItem: { fontSize: 14 },
  dateExportContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  dateRangeText: { fontSize: 15, fontWeight: "600", color: "#333" },
  exportButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#3B82F6", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  exportIcon: { marginRight: 6 },
  exportText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  datePickerContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  datePickerButton: {
    flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 12, marginHorizontal: 4, flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  dateText: { fontSize: 13 },
  calendarIcon: { marginRight: 8 },
  metricContainer: { flexDirection: "row", marginBottom: 16, justifyContent: "center", flexWrap: "wrap" },
  metricButton: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 4, marginBottom: 8, borderRadius: 24, backgroundColor: "#E5E7EB" },
  metricIcon: { marginRight: 6 },
  metricText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  chartModeContainer: { flexDirection: "row", marginBottom: 16, justifyContent: "center", gap: 8 },
  modeButton: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "#f0f0f0", gap: 6 },
  modeButtonActive: { backgroundColor: "#3B82F6" },
  modeButtonText: { color: "#666", fontWeight: "500", fontSize: 13 },
  modeButtonTextActive: { color: "#fff" },
  chartOuterContainer: { backgroundColor: "#fff", borderRadius: 16, padding: 10, marginTop: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  chartTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 8, textAlign: "center" },
  chartScrollContainer: { paddingBottom: 10 },
  chart: { borderRadius: 16, marginTop: 8 },
  legendContainer: { flexDirection: "row", justifyContent: "center", marginTop: 12, marginBottom: 8, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 8, marginBottom: 8 },
  legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  legendText: { fontSize: 11, color: "#444" },
  loadingContainer: { marginTop: 40, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#555", marginLeft: 8 },
  noDataText: { textAlign: "center", marginVertical: 16, color: "gray" },
  footer: { marginTop: 16, marginBottom: 24, alignItems: "center" },
  footerText: { fontSize: 12, color: "#888", fontStyle: "italic" },
  noDevicesWarning: { alignItems: "center", padding: 10 },
  noDeviceText: { fontSize: 14, color: "#666", marginBottom: 10, textAlign: "center" },
  addDeviceButton: { backgroundColor: "#007AFF", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  addDeviceButtonText: { color: "#fff", fontWeight: "bold" },
  loadingSection: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 10 },
});