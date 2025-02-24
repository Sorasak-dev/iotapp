import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function DeviceMonitorScreen  () {
  const [isEnabled, setIsEnabled] = useState(true);
  const router = useRouter();
  const [expandedCard, setExpandedCard] = useState(null);

  const toggleCard = (card) => {
    setExpandedCard(expandedCard === card ? null : card);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.header}>Device Monitor</Text>
            <Text style={styles.subHeader}>Sensor Status Overview</Text>
          </View>
        </View>

        {/* Device Selector */}
        <View style={styles.deviceSelector}>
          <View style={styles.sensorIndicator}>
            <View style={styles.dot} />
            <Text style={styles.sensorText}>Sensor IBS-TH3</Text>
          </View>
          <View style={styles.notificationContainer}>
            <Ionicons name="notifications-outline" size={24} color="#666" />
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: "#ddd", true: "#4CAF50" }}
              thumbColor={"#fff"}
              style={{ marginLeft: 8 }}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>System Status</Text>

        {/* Status Grid */}
        <View style={styles.gridContainer}>
          <View style={[styles.gridItem, styles.connected]}>
            <Ionicons name="wifi" size={24} color="#22c55e" />
            <Text style={styles.gridLabel}>WiFi Status</Text>
            <Text style={styles.gridValue}>Connected</Text>
          </View>

          <View style={[styles.gridItem, styles.battery]}>
            <Ionicons name="battery-half" size={24} color="#f59e0b" />
            <Text style={styles.gridLabel}>Battery Status</Text>
            <Text style={styles.gridValue}>20%</Text>
          </View>

          <View style={[styles.gridItem, styles.normal]}>
            <FontAwesome5 name="check-circle" size={24} color="#3b82f6" />
            <Text style={styles.gridLabel}>Data Status</Text>
            <Text style={styles.gridValue}>Normal</Text>
          </View>

          <View style={[styles.gridItem, styles.error]}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <Text style={styles.gridLabel}>Device Health</Text>
            <Text style={styles.gridValue}>Error</Text>
          </View>
        </View>

        {/* Error Section */}
        <View style={styles.errorSection}>
          <View style={styles.errorHeader}>
            <View style={styles.errorTitleContainer}>
              <Ionicons name="warning" size={20} color="#ef4444" />
              <Text style={styles.errorTitle}>Device Errors</Text>
            </View>
            <Text style={styles.errorTime}>1 hour ago</Text>
          </View>
          <View style={styles.errorList}>
            <View style={styles.errorItem}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>Temperature sensor calibration required</Text>
            </View>
            <View style={styles.errorItem}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>Humidity sensor needs maintenance</Text>
            </View>
          </View>
        </View>

        {/* Measurement Cards */}
        {[
          { name: "Temperature", value: "24.5°C", icon: "thermometer-half", color: "#3b82f6" },
          { name: "Humidity", value: "65%", icon: "tint", color: "#f59e0b" },
          { name: "Dew Point", value: "24.5°C", icon: "tint", color: "#06b6d4" },
        ].map((item, index) => {
          const isExpanded = expandedCard === item.name;

          return (
            <View key={index}>
              <TouchableOpacity onPress={() => toggleCard(item.name)}>
                <View style={styles.measurementCard}>
                  <View style={styles.measurementContent}>
                    <FontAwesome5 name={item.icon} size={24} color={item.color} />
                    <Text style={styles.measurementLabel}>{item.name}</Text>
                    <Text style={styles.measurementValue}>{item.value}</Text>
                  </View>
                  <View style={styles.updateContainer}>
                    <Text style={styles.updateText}>Updated 5 min ago</Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="gray"
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Graph Section (แสดงเมื่อการ์ดถูกขยาย) */}
              {isExpanded && (
                <View style={styles.graphContainer}>
                  <Text style={styles.graphText}>📊 {item.name} Graph Placeholder</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1e293b",
  },
  subHeader: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  deviceSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sensorIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  sensorText: {
    fontSize: 16,
    color: "#1e293b",
  },
  notificationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: -6,
  },
  gridItem: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  connected: {
    backgroundColor: "#dcfce7",
  },
  battery: {
    backgroundColor: "#fef3c7",
  },
  normal: {
    backgroundColor: "#dbeafe",
  },
  error: {
    backgroundColor: "#fee2e2",
  },
  gridLabel: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1e293b",
    marginTop: 4,
  },
  errorSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  errorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  errorTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  errorTime: {
    fontSize: 14,
    color: "#94a3b8",
  },
  errorList: {
    gap: 8,
  },
  errorItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#64748b",
  },
  measurementCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  measurementContent: {
    gap: 8,
  },
  measurementLabel: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  measurementValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1e293b",
  },
  updateContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  updateText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  trendUp: {
    width: 12,
    height: 12,
    borderColor: "#22c55e",
    borderWidth: 2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    transform: [{ rotate: "45deg" }],
  },
  trendDown: {
    width: 12,
    height: 12,
    borderColor: "#ef4444",
    borderWidth: 2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: "45deg" }],
  },
});
