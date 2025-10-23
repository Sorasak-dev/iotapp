import { useState, useEffect, useCallback, useRef } from "react";
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

const SENSOR_COLORS = [
  "#FF6384", "#36A2EB", "#4BC0C0", "#22C55E", "#FFCE56",
  "#9966FF", "#FF9F40", "#20C997", "#6C757D", "#FD7E14",
];

export default function Statistics() {
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedMetrics, setSelectedMetrics] = useState(["Temperature", "Humidity", "Dew Point", "VPD"]);
  const [selectedZones, setSelectedZones] = useState([]);
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
      Alert.alert("Not supported on Web", "Please run on Android/iOS.");
      return;
    }
    setShowStartPicker(true);
  };
  const openEndPicker = () => {
    if (Platform.OS === "web") {
      Alert.alert("Not supported on Web", "Please run on Android/iOS.");
      return;
    }
    setShowEndPicker(true);
  };

  const onConfirmStart = (date) => {
    setTempStartDate(date);
    setStartDate(date);
    setShowStartPicker(false);
    setShowEndPicker(true); 
  };
  const onConfirmEnd = (date) => {
    setTempEndDate(date);
    setEndDate(date);
    setShowEndPicker(false);
  };

  const prepareChartData = () => {
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

    const datasets = [];
    Object.entries(data).forEach(([_, sensorData], sensorIndex) => {
      const map = sensorData.data.reduce((acc, it) => ((acc[it.timestamp] = it), acc), {});
      const idx = sensorIndex % SENSOR_COLORS.length;

      const colorPick = (opacity, palette) => {
        const set = {
          base: [
            "rgba(255, 99, 132, OP)", "rgba(54, 162, 235, OP)", "rgba(75, 192, 192, OP)",
            "rgba(34, 197, 94, OP)", "rgba(255, 206, 86, OP)", "rgba(153, 102, 255, OP)",
            "rgba(255, 159, 64, OP)", "rgba(32, 201, 151, OP)", "rgba(108, 117, 125, OP)",
            "rgba(253, 126, 20, OP)",
          ],
          dark: [
            "rgba(215, 59, 92, OP)", "rgba(14, 122, 195, OP)", "rgba(35, 152, 152, OP)",
            "rgba(0, 157, 54, OP)", "rgba(215, 166, 46, OP)", "rgba(113, 62, 215, OP)",
            "rgba(215, 119, 24, OP)", "rgba(0, 161, 111, OP)", "rgba(68, 77, 85, OP)",
            "rgba(213, 86, 0, OP)",
          ],
          light: [
            "rgba(255, 139, 172, OP)", "rgba(94, 202, 255, OP)", "rgba(115, 232, 232, OP)",
            "rgba(74, 237, 134, OP)", "rgba(255, 246, 126, OP)", "rgba(193, 142, 255, OP)",
            "rgba(255, 199, 104, OP)", "rgba(72, 241, 191, OP)", "rgba(148, 157, 165, OP)",
            "rgba(255, 166, 60, OP)",
          ],
        };
        return (set[palette][idx] || set.base[0]).replace("OP", String(opacity ?? 1));
      };

      if (selectedMetrics.includes("Temperature")) {
        datasets.push({
          data: allTs.map((ts) => map[ts]?.temperature ?? 0),
          color: (o) => colorPick(o, "base"),
          strokeWidth: 2,
          withDots: true,
          sensorName: sensorData.name,
          metric: "Temperature",
        });
      }
      if (selectedMetrics.includes("Humidity")) {
        datasets.push({
          data: allTs.map((ts) => map[ts]?.humidity ?? 0),
          color: (o) => colorPick(o, "dark"),
          strokeWidth: 2,
          withDots: true,
          dashArray: [5, 5],
          sensorName: sensorData.name,
          metric: "Humidity",
        });
      }
      if (selectedMetrics.includes("Dew Point")) {
        datasets.push({
          data: allTs.map((ts) => map[ts]?.dew_point ?? 0),
          color: (o) => colorPick(o, "light"),
          strokeWidth: 2,
          withDots: true,
          dashArray: [2, 2],
          sensorName: sensorData.name,
          metric: "Dew Point",
        });
      }
      if (selectedMetrics.includes("VPD")) {
        datasets.push({
          data: allTs.map((ts) => map[ts]?.vpd ?? 0),
          color: (o) => colorPick(o, "dark"),
          strokeWidth: 2,
          withDots: true,
          dashArray: [5, 2, 2, 2],
          sensorName: sensorData.name,
          metric: "VPD",
        });
      }
    });

    return {
      labels,
      datasets: datasets.length ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }],
    };
  };

  const chartData =
    Object.keys(data).length > 0
      ? prepareChartData()
      : { labels: ["No Data"], datasets: [{ data: [0, 0, 0], color: () => "transparent" }] };

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

              {/* ปุ่มไปหน้า Export */}
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

            {/* Date pickers */}
            <DateTimePickerModal
              isVisible={showStartPicker}
              mode="date"
              date={tempStartDate}
              onConfirm={onConfirmStart}
              onCancel={() => setShowStartPicker(false)}
            />
            <DateTimePickerModal
              isVisible={showEndPicker}
              mode="date"
              date={tempEndDate}
              onConfirm={onConfirmEnd}
              onCancel={() => setShowEndPicker(false)}
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
            ) : (
              <View style={styles.chartOuterContainer}>
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
                      propsForDots: { r: "5", strokeWidth: "2", stroke: "#fff" },
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

                {/* Legend */}
                <View style={styles.legendContainer}>
                  {chartData.datasets
                    .filter((d) => d.sensorName)
                    .map((d, i) => (
                      <View key={i} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendColor,
                            { backgroundColor: d.color(1), borderStyle: d.dashArray ? "dashed" : "solid" },
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
  chartOuterContainer: { backgroundColor: "#fff", borderRadius: 16, padding: 10, marginTop: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
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
