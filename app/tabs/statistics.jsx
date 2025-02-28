import React, { useState, useEffect } from "react";
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
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dropdown } from "react-native-element-dropdown";
import { FontAwesome5 } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const screenWidth = Dimensions.get("window").width;

const API_URL = "http://192.168.1.12:3000/api/user/sensor-data";

export default function Statistics() {
  const [selectedMetrics, setSelectedMetrics] = useState(["Temperature", "Humidity", "Dew Point"]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [tempStartDate, setTempStartDate] = useState(new Date()); // วันที่ชั่วคราวสำหรับ picker
  const [tempEndDate, setTempEndDate] = useState(new Date());     // วันที่ชั่วคราวสำหรับ picker
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);


  const sensors = [
    { label: "Sensor IBS-TH3", value: "Sensor IBS-TH3" },
    { label: "Sensor X-200", value: "Sensor X-200" },
  ];

  useEffect(() => {
    const today = new Date();
    setStartDate(today);
    setEndDate(today);
    setTempStartDate(today);
    setTempEndDate(today);

    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    fetchSensorData(today.toISOString().split("T")[0], today.toISOString().split("T")[0]);

    return () => clearInterval(interval);
  }, []);

  const calculateDewPoint = (temperature, humidity) => {
    if (temperature === null || humidity === null) return null;
    return temperature - (100 - humidity) / 5;
  };

  const calculateHourlyAverages = (data) => {
    const hourlyData = {};

    data.forEach((item) => {
      const date = new Date(item.timestamp);
      const hour = date.getHours();
      const key = `${hour}:00`;

      if (!hourlyData[key]) {
        hourlyData[key] = {
          temperature: 0,
          humidity: 0,
          dewPoint: 0,
          count: 0,
        };
      }

      if (item.temperature !== null) {
        hourlyData[key].temperature += item.temperature;
        hourlyData[key].count += 1;
      }
      if (item.humidity !== null) {
        hourlyData[key].humidity += item.humidity;
      }
    });

    const averagedData = Object.keys(hourlyData).map((hour) => {
      const avgTemperature = hourlyData[hour].count
        ? hourlyData[hour].temperature / hourlyData[hour].count
        : 0;
      const avgHumidity = hourlyData[hour].count
        ? hourlyData[hour].humidity / hourlyData[hour].count
        : 0;
      const dewPoint = calculateDewPoint(avgTemperature, avgHumidity);

      return {
        hour,
        temperature: avgTemperature,
        humidity: avgHumidity,
        dewPoint,
      };
    });

    return averagedData;
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

      const response = await fetch(`${API_URL}?startDate=${start}&endDate=${end}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (response.ok) {
        if (!result.data || !Array.isArray(result.data)) {
          Alert.alert("Error", "No sensor data available.");
          setData([]);
        } else {
          const averagedData = calculateHourlyAverages(result.data);
          console.log("Averaged Data:", averagedData);
          setData(averagedData);
        }
      } else {
        Alert.alert("Error", result.message || "Failed to fetch sensor data.");
      }
    } catch (err) {
      Alert.alert("Error", "Network error occurred: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = (metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const onStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempStartDate;
    setTempStartDate(currentDate); // อัปเดตวันที่ชั่วคราว
  };

  const onEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempEndDate;
    setTempEndDate(currentDate); // อัปเดตวันที่ชั่วคราว
  };

  const confirmStartDate = () => {
    setStartDate(tempStartDate);
    fetchSensorData(tempStartDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
    setShowStartPicker(false);
  };

  const confirmEndDate = () => {
    setEndDate(tempEndDate);
    fetchSensorData(startDate.toISOString().split("T")[0], tempEndDate.toISOString().split("T")[0]);
    setShowEndPicker(false);
  };

  const cancelPicker = () => {
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const chartData = {
    labels: data.map((item) => item.hour),
    datasets: [
      selectedMetrics.includes("Temperature") && {
        data: data.map((item) => item.temperature || 0),
        color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
        strokeWidth: 2,
      },
      selectedMetrics.includes("Humidity") && {
        data: data.map((item) => item.humidity || 0),
        color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
        strokeWidth: 2,
      },
      selectedMetrics.includes("Dew Point") && {
        data: data.map((item) => item.dewPoint || 0),
        color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
        strokeWidth: 2,
      },
    ].filter(Boolean),
  };

  const finalData = chartData.datasets.length > 0
    ? chartData
    : {
        ...chartData,
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0], color: () => "transparent" }],
      };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Statistics</Text>

      <Text style={styles.currentDateText}>
        Current Date and Time: {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
      </Text>

      <View style={styles.dropdownContainer}>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.dropdownPlaceholder}
          selectedTextStyle={styles.dropdownSelectedText}
          inputSearchStyle={styles.dropdownInputSearch}
          data={sensors}
          search
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder="Select Sensor"
          searchPlaceholder="Search..."
          value={selectedSensor}
          onChange={(item) => setSelectedSensor(item.value)}
        />
      </View>

      <Text style={styles.dateRangeText}>SELECT DATE RANGE</Text>

      <View style={styles.datePickerContainer}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowStartPicker(true)}
        >
          <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
          <Text>{startDate.toLocaleDateString() || "Start Date"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowEndPicker(true)}
        >
          <FontAwesome5 name="calendar" size={16} color="#1E90FF" style={styles.calendarIcon} />
          <Text>{endDate.toLocaleDateString() || "End Date"}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal สำหรับ Start Date Picker */}
      <Modal visible={showStartPicker} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Start Date</Text>
            <DateTimePicker
              value={tempStartDate}
              mode="date"
              display="default"
              onChange={onStartDateChange}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelPicker}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmStartDate}>
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal สำหรับ End Date Picker */}
      <Modal visible={showEndPicker} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select End Date</Text>
            <DateTimePicker
              value={tempEndDate}
              mode="date"
              display="default"
              onChange={onEndDateChange}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelPicker}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmEndDate}>
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.metricContainer}>
        {["Temperature", "Humidity", "Dew Point"].map((metric) => (
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
                    : "#4BC0C0",
              },
            ]}
          >
            <FontAwesome5
              name={
                metric === "Temperature"
                  ? "thermometer-half"
                  : metric === "Humidity"
                  ? "tint"
                  : "cloud"
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
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <ScrollView horizontal>
          <LineChart
            data={finalData}
            width={Math.max(screenWidth, data.length * 60)}
            height={220}
            chartConfig={{
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: "#fff",
              },
            }}
            bezier
            style={styles.chart}
          />
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  currentDateText: {
    fontSize: 16,
    marginBottom: 10,
  },
  dropdownContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  dropdown: {
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  dropdownPlaceholder: {
    color: "#000",
  },
  dropdownSelectedText: {
    color: "#000",
  },
  dropdownInputSearch: {
    height: 40,
    fontSize: 16,
  },
  dateRangeText: {
    fontSize: 15,
    fontWeight: "400",
    marginBottom: 20,
  },
  datePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  calendarIcon: {
    marginRight: 8,
  },
  metricContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  metricButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  metricIcon: {
    marginRight: 5,
  },
  metricText: {
    color: "#fff",
  },
  chart: {
    borderRadius: 10,
    marginTop: 20,
  },
  // Styles สำหรับ Modal และ Picker
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // พื้นหลังโปร่งแสง
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
});