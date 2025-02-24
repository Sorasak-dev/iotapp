import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, Line, G } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const API_URL = 'https://8e25-202-28-45-134.ngrok-free.app';
const SENSOR_IMAGE = require("../assets/sensor.png");

export default function Statistics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const [selectedDate, setSelectedDate] = useState("");
  const [sensorExpanded, setSensorExpanded] = useState(false);

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          Alert.alert("Error", "Please log in again.");
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/user/sensor-data`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();
        if (response.ok) {
          setData(result.data || []);
          setSelectedDate(result.date || "");
        } else {
          Alert.alert("Error", result.message || "Failed to fetch data.");
        }
      } catch (err) {
        Alert.alert("Error", "Network error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();
    const interval = setInterval(fetchSensorData, 3600000);
    return () => clearInterval(interval);
  }, []);

  // เพิ่มฟังก์ชันสำหรับดึงข้อมูลล่าสุด
  const getLatestData = () => {
    if (data.length === 0) {
      return {
        temperature: "N/A",
        humidity: "N/A",
        battery: "N/A",
      };
    }
    const latest = data[data.length - 1];
    return {
      temperature: latest.temperature?.toFixed(1) || "N/A",
      humidity: latest.humidity?.toFixed(1) || "N/A",
      battery: latest.battery || "N/A",
    };
  };

  const latestData = getLatestData();

  // ส่วนที่เหลือของ component (chartWidth, chartHeight, etc...)
  const chartWidth = Math.max(data.length * 60, width * 0.8);
  const chartHeight = 400;
  const barWidth = 18;
  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.temperature || 0, item.humidity || 0)),
    100
  );
  const labels = data.map((item) =>
    new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const renderYAxisLabels = () => {
    return [0, 20, 40, 60, 80].map((y, index) => (
      <G key={index}>
        <Line
          x1="60"
          y1={chartHeight - (y / 100) * chartHeight}
          x2={chartWidth + 20}
          y2={chartHeight - (y / 100) * chartHeight}
          stroke="#ddd"
          strokeWidth="1"
        />
        <SvgText
          x="40"
          y={chartHeight - (y / 100) * chartHeight + 5}
          fontSize="12"
          textAnchor="end"
          fill="gray"
        >
          {y}
        </SvgText>
      </G>
    ));
  };

  const renderBars = () => {
    return data.map((item, index) => {
      const tempHeight = ((item.temperature || 0) / maxValue) * chartHeight;
      const humidityHeight = ((item.humidity || 0) / maxValue) * chartHeight;
      const xPos = index * (barWidth * 2 + 10) + 70;

      return (
        <G key={index}>
          <Rect
            x={xPos}
            y={chartHeight - tempHeight}
            width={barWidth}
            height={tempHeight}
            fill="#007AFF"
            rx={4}
          />
          <Rect
            x={xPos + barWidth + 5}
            y={chartHeight - humidityHeight}
            width={barWidth}
            height={humidityHeight}
            fill="#FFA500"
            rx={4}
          />
          <SvgText
            x={xPos + barWidth / 2}
            y={chartHeight + 40}
            fontSize="12"
            textAnchor="middle"
            fill="black"
            transform={`rotate(90, ${xPos + barWidth / 2}, ${
              chartHeight + 40
            })`}
          >
            {labels[index]}
          </SvgText>
        </G>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
        </View>

        <View style={styles.filterContainer}>
          {["Today", "Month", "Year"].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.dateText}>{selectedDate}</Text>

        <TouchableOpacity
          style={[
            styles.sensorBox,
            sensorExpanded && styles.sensorBoxExpanded, 
          ]}
          onPress={() => setSensorExpanded(!sensorExpanded)}
        >
          <Image source={SENSOR_IMAGE} style={styles.sensorImage} />
          <View style={styles.sensorInfo}>
            <Text style={styles.sensorText}>Sensor IBS-TH3</Text>
            <Text style={styles.sensorStatusText}>
              {loading
                ? "Updating..."
                : "Last updated: " + new Date().toLocaleTimeString()}
            </Text>
          </View>
          <Ionicons
            name={sensorExpanded ? "chevron-up" : "chevron-down"}
            size={24}
            color="gray"
            style={styles.sensorIcon}
          />
        </TouchableOpacity>

        {sensorExpanded && (
          <View style={styles.sensorDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="thermometer-outline" size={20} color="#FF6B6B" />
              <Text style={styles.detailText}>
                Temperature: {latestData.temperature}°C
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="water-outline" size={20} color="#4DABF7" />
              <Text style={styles.detailText}>
                Humidity: {latestData.humidity}%
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="battery-full-outline" size={20} color="#51CF66" />
              <Text style={styles.detailText}>
                Battery: {latestData.battery}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.chartContainer}>
          <ScrollView horizontal contentContainerStyle={{ width: chartWidth }}>
            <Svg width={chartWidth} height={chartHeight + 80}>
              {renderYAxisLabels()}
              {renderBars()}
            </Svg>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#333",
  },
  chartContainer: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: "#EAEAEA",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
  },
  filterText: {
    fontSize: 16,
    color: "#333",
  },
  filterTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  dateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  sensorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
  },

  sensorBoxExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },

  sensorImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  sensorStatusText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  sensorIcon: {
    marginLeft: 10,
  },
  sensorDetails: {
    backgroundColor: "#FFF",
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: "#555",
    marginLeft: 10,
  },
});
