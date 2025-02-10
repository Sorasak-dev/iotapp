import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Button,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart } from "react-native-chart-kit";

const API_URL = 'http://192.168.1.11:4000';

export default function Statistics() {
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [removedErrors, setRemovedErrors] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const email = await AsyncStorage.getItem("email");

        if (!token || !email) {
          Alert.alert("Error", "Authentication token or user not found. Please log in again.");
          return;
        }

        const response = await fetch(`${API_URL}/api/user/sensor-data`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();
        if (response.ok) {
          setData(result.data || []);
          setErrors(
            result.data
              .filter(
                (item) =>
                  item.temperature === null ||
                  item.temperature === 0 ||
                  item.humidity === null ||
                  item.humidity === 0
              )
              .map((item) => ({
                key: `${item.sensorId}-${item.timestamp}`,
                sensorId: item.sensorId,
                timestamp: new Date(item.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                type: item.temperature === null || item.temperature === 0 ? "Temperature" : "Humidity",
              }))
          );
        } else {
          Alert.alert("Error", result.message || "Failed to fetch sensor data.");
        }
      } catch (err) {
        Alert.alert("Error", "Network error occurred while fetching sensor data.");
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();

    const interval = setInterval(fetchSensorData, 60000); 
    return () => clearInterval(interval);
  },
); 

  const temperatureData = data.map((item) => item.temperature || 0);
  const humidityData = data.map((item) => item.humidity || 0);
  const labels = data.map((item) =>
    new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  const chartWidth = Math.max(labels.length * 80, Dimensions.get("window").width);

  return (
    <ScrollView style={styles.container}>
        {/* Summary Section */}
        <View style={styles.summaryContainer}>
        {/* Temperature Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>
            {data.length > 0
              ? `${
                  data.reduce(
                    (latest, item) =>
                      new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
                  ).temperature ?? 0
                }°C`
              : "N/A"}
          </Text>
          <Text style={styles.summaryLabelBold}>Temperature</Text>
          {data.length > 0 &&
            data.reduce(
              (latest, item) =>
                new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
            ).temperature === null && (
              <Text style={styles.errorText}>(Error AM2315)</Text>
            )}
        </View>

        {/* Humidity Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>
            {data.length > 0
              ? `${
                  data.reduce(
                    (latest, item) =>
                      new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
                  ).humidity ?? 0
                }%`
              : "N/A"}
          </Text>
          <Text style={styles.summaryLabelBold}>Humidity</Text>
          {data.length > 0 &&
            data.reduce(
              (latest, item) =>
                new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
            ).humidity === null && (
              <Text style={styles.errorText}>(Error AM2315)</Text>
            )}
        </View>
      </View>
    {/* Temperature Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Temperature</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{
              labels,
              datasets: [{ data: temperatureData }],
            }}
            width={chartWidth}
            height={220}
            yAxisSuffix="°C"
            chartConfig={{
              backgroundColor: "#ffffff", // พื้นหลังสีขาว
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // สีแดงเข้ม
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // สีข้อความ
              barPercentage: 0.8,
              propsForBackgroundLines: {
                strokeWidth: 0, // ลบเส้น Grid Lines
              },
            }}
            hideHorizontalLines={true} // ซ่อนเส้นแนวนอน
            hideVerticalLines={true} // ซ่อนเส้นแนวตั้ง
            style={styles.chart}
          />
        </ScrollView>
      </View>

      {/* Humidity Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Humidity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{
              labels,
              datasets: [{ data: humidityData }],
            }}
            width={chartWidth}
            height={220}
            yAxisSuffix="%"
            chartConfig={{
              backgroundColor: "#ffffff", // พื้นหลังสีขาว
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`, // สีน้ำเงินเข้ม
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // สีข้อความ
              barPercentage: 0.8,
              propsForBackgroundLines: {
                strokeWidth: 0, // ลบเส้น Grid Lines
              },
            }}
            hideHorizontalLines={true} // ซ่อนเส้นแนวนอน
            hideVerticalLines={true} // ซ่อนเส้นแนวตั้ง
            style={styles.chart}
          />
        </ScrollView>
      </View>

      {/* Errors Section */}
      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          {errors.map((error) => (
            <View key={error.key} style={styles.errorBox}>
              <Text style={styles.errorText}>
                {`Error: ${error.type} sensor (ID: ${error.sensorId}) at ${error.timestamp}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 16,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center", // จัดทุกอย่างใน View ให้อยู่กึ่งกลางแนวนอน
    justifyContent: "center", // จัดทุกอย่างใน View ให้อยู่กึ่งกลางแนวตั้ง
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  summaryLabelBold: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: "#d9534f",
    marginTop: 2,
    textAlign: "center", 
    alignSelf: "center", 
  },
  chartContainer: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  chart: {
    borderRadius: 16,
  },
  errorContainer: {
    marginTop: 10,
  },
  errorBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
});
