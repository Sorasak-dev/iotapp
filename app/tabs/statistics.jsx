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
import { MaterialCommunityIcons } from "@expo/vector-icons"; 
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";

const API_URL = 'https://81af-202-28-45-128.ngrok-free.app';
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

  const chartWidth = Math.max(data.length * 60, Dimensions.get("window").width - 40);
  const chartHeight = 400;
  const barWidth = 18;
  const maxValue = Math.max(...data.map((item) => Math.max(item.temperature || 0, item.humidity || 0)), 100);
  const labels = data.map((item) =>
    new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      
       {/* 📌 แถบเลือกช่วงเวลา (Today, Month, Year) */}
       <View style={styles.filterContainer}>
        {["Today", "Month", "Year"].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 📌 วันที่ของข้อมูล */}
      <Text style={styles.dateText}>{selectedDate}</Text>

          {/* 📌 กล่องเซนเซอร์ */}
          <TouchableOpacity
        style={styles.sensorBox}
        onPress={() => setSensorExpanded(!sensorExpanded)}
      >
        <Image source={SENSOR_IMAGE} style={styles.sensorImage} />
        <Text style={styles.sensorText}>Sensor IBS-TH3</Text>
        <Ionicons
          name={sensorExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color="gray"
          style={styles.sensorIcon}
        />
      </TouchableOpacity>

      {/* ✅ แสดงข้อมูลเมื่อกดขยาย */}
      {sensorExpanded && (
        <View style={styles.sensorDetails}>
          <Text style={styles.detailText}>Temperature: 24°C</Text>
          <Text style={styles.detailText}>Humidity: 60%</Text>
          <Text style={styles.detailText}>Battery: 80%</Text>
        </View>
      )}

      {/* Sensor Title + Legend */}
      <View style={styles.chartHeader}>
        {/* ✅ Temperature & Humidity แยกบรรทัดกัน */}
        <View style={styles.chartTitleContainer}>
          <View style={styles.titleRow}>
            <Ionicons name="thermometer-outline" size={26} color="#007AFF" />
            <Text style={styles.chartTitle}>Temperature</Text>
          </View>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="water" size={26} color="#FFA500" />
            <Text style={styles.chartTitle}>Humidity</Text>
          </View>
        </View>

        {/* ✅ Legend ขยับไปด้านขวา */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#7DAAFB" }]} />
            <Text style={styles.legendText}>Temperature</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FFA500" }]} />
            <Text style={styles.legendText}>Humidity</Text>
          </View>
        </View>
      </View>

      {/* Custom Bar Chart */}
      <View style={styles.chartContainer}>
        <ScrollView horizontal contentContainerStyle={{ width: chartWidth }}>
          <Svg width={chartWidth + 40} height={chartHeight + 80}>
            {/* Y-axis grid lines */}
            {[0, 20, 40, 60, 80].map((y, index) => (
              <React.Fragment key={index}>
                <Line x1="60" y1={chartHeight - (y / 100) * chartHeight} x2={chartWidth + 20} y2={chartHeight - (y / 100) * chartHeight} stroke="#ddd" strokeWidth="1" />
                <SvgText x="40" y={chartHeight - (y / 100) * chartHeight + 5} fontSize="12" textAnchor="end" fill="gray">
                  {y}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Bars */}
            {data.map((item, index) => {
              const tempHeight = ((item.temperature || 0) / maxValue) * chartHeight;
              const humidityHeight = ((item.humidity || 0) / maxValue) * chartHeight;
              const xPos = index * (barWidth * 2 + 10) + 70;

              return (
                <React.Fragment key={index}>
                  <Rect x={xPos} y={chartHeight - tempHeight} width={barWidth} height={tempHeight} fill="#007AFF" rx={4} />
                  <Rect x={xPos + barWidth + 5} y={chartHeight - humidityHeight} width={barWidth} height={humidityHeight} fill="#FFA500" rx={4} />

                  <SvgText
                    x={xPos + barWidth / 2}
                    y={chartHeight + 40}
                    fontSize="12"
                    textAnchor="middle"
                    fill="black"
                    transform={`rotate(90, ${xPos + barWidth / 2}, ${chartHeight + 40})`}
                  >
                    {labels[index]}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9", padding: 16 },
  
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerTitle: { fontSize: 25, fontWeight: "bold", color: "#333" },

  // 📌 Chart Container
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

  // 📌 Chart Header
  chartHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginBottom: 12 
  },

  chartTitleContainer: { 
    flexDirection: "column", 
    alignItems: "flex-start",
  },

  titleRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 5, 
  },

  chartTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginLeft: 6, 
    color: "#333" 
  },

  legendContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
  },

  legendItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginLeft: 15 
  },

  legendDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    marginRight: 5 
  },

  legendText: { 
    fontSize: 14, 
    color: "#666" 
  },

  filterContainer: { 
    flexDirection: "row", 
    justifyContent: "center", 
    marginBottom: 16 
  },

  filterButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    marginHorizontal: 5, 
    borderRadius: 20, 
    backgroundColor: "#EAEAEA" 
  },

  filterButtonActive: { 
    backgroundColor: "#007AFF"
  },

  filterText: { 
    fontSize: 16, 
    color: "#333" 
  },

  filterTextActive: { 
    color: "#FFFFFF", 
    fontWeight: "bold" 
  },

   // 📌 Sensor Box
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
  sensorImage: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  sensorText: { fontSize: 16, fontWeight: "bold", color: "#333", flex: 1 },
  sensorIcon: { marginRight: 10 },

  // 📌 Sensor Details
  sensorDetails: {
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
  detailText: { fontSize: 14, color: "#555", marginBottom: 5 },
});

