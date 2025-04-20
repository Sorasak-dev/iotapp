import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';

const deviceImages = {
  "sensor.png": "https://example.com/images/sensor.png",
  "sensor2.png": "https://example.com/images/sensor2.png",
  "sensor3.png": "https://example.com/images/sensor3.png",
  "sensor4.png": "https://example.com/images/sensor4.png",
};

const devices = [
  { id: "1", name: "IBS-TH3", type: "Temperature & Humidity Sensor", image: require("../assets/sensor.png") },
  { id: "2", name: "IBS-TH4", type: "Temperature & Humidity Sensor", image: require("../assets/sensor2.png") },
  { id: "3", name: "IBS-TH5", type: "Temperature & Humidity Sensor", image: require("../assets/sensor3.png") },
  { id: "4", name: "IBS-TH6", type: "Temperature & Humidity Sensor", image: require("../assets/sensor4.png") },
];

export default function SelectDeviceScreen() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectingDevice, setConnectingDevice] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All"); 
  const params = useLocalSearchParams();
  const returnTo = params.returnTo;
  const [spinValue] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchConnectedDevices();
  }, []);

  const fetchConnectedDevices = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Authentication Error",
          text2: "Please log in to continue.",
        });
        router.replace("/auth/sign-in");
        return;
      }

      const response = await axios.get(API_ENDPOINTS.DEVICES, {
        headers: getAuthHeaders(token), 
        timeout: API_TIMEOUT
      });

      if (Array.isArray(response.data)) {
        const connectedIds = response.data.map((device) => device.deviceId);
        setConnectedDevices(connectedIds);
      }
    } catch (error) {
      console.error("Error fetching connected devices:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await AsyncStorage.removeItem("token");
        Toast.show({
          type: "error",
          text1: "Session Expired",
          text2: "Please log in again.",
        });
        router.replace("/auth/sign-in");
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to fetch connected devices.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const startSpinning = () => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleConnect = async (device) => {
    setConnectingDevice(device);
    setConnecting(true);
    startSpinning();

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Authentication Error",
          text2: "Please log in to continue.",
        });
        setConnecting(false);
        router.replace("/auth/sign-in");
        return;
      }

      const imageFileName = device.image?.default?.split("/").pop() || "";
      const imageUrl = deviceImages[imageFileName] || "https://example.com/images/default.png";

      const response = await axios.post(
        API_ENDPOINTS.DEVICES,
        {
          name: device.name,
          type: device.type,
          image: imageUrl, 
          deviceId: device.id,
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: API_TIMEOUT 
        }
      );

      console.log("✅ Device Connected:", response.data);

      setConnectedDevices((prev) => [...prev, device.id]);
      setConnecting(false);
      setConnected(true);

      setTimeout(() => {
        setConnected(false);
        if (returnTo === "statistics") {
          router.replace("/tabs/statistics");
        } else {
          router.replace("/tabs/home");
        }
      }, 1500);
    } catch (error) {
      console.error("❌ Error connecting device:", error);
      setConnecting(false);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await AsyncStorage.removeItem("token");
        Toast.show({
          type: "error",
          text1: "Session Expired",
          text2: "Please log in again.",
        });
        router.replace("/auth/sign-in");
      } else {
        Toast.show({
          type: "error",
          text1: "Connection Failed",
          text2: error.response?.data?.message || "Failed to connect device.",
        });
      }
    }
  };

  const isDeviceConnected = (deviceId) => {
    return connectedDevices.includes(deviceId);
  };

  const filteredDevices = () => {
    if (activeTab === "All") {
      return devices;
    } else if (activeTab === "Sensors") {
      return devices.filter((device) => device.type.includes("Sensor"));
    } else if (activeTab === "Temperature") {
      return devices.filter((device) => device.type.includes("Temperature"));
    }
    return devices;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Searching for devices...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Device</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "All" ? styles.activeTab : null]}
          onPress={() => setActiveTab("All")}
        >
          <Text style={[styles.tabText, activeTab === "All" ? styles.activeTabText : null]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Sensors" ? styles.activeTab : null]}
          onPress={() => setActiveTab("Sensors")}
        >
          <Text style={[styles.tabText, activeTab === "Sensors" ? styles.activeTabText : null]}>Sensors</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Temperature" ? styles.activeTab : null]}
          onPress={() => setActiveTab("Temperature")}
        >
          <Text style={[styles.tabText, activeTab === "Temperature" ? styles.activeTabText : null]}>Temperature</Text>
        </TouchableOpacity>
      </View>

      {/* Scanning Text */}
      <Text style={styles.scanningText}>🔍 Scanning for devices...</Text>

      {/* Device List */}
      <FlatList
        data={filteredDevices()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const isConnected = isDeviceConnected(item.id);
          const isCurrentlyConnecting = connecting && connectingDevice?.id === item.id;
          const isCurrentlyConnected = connected && connectingDevice?.id === item.id;

          return (
            <View style={styles.deviceItem}>
              <Image source={item.image} style={styles.deviceImage} />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceType}>{item.type}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.connectButton,
                  isConnected ? styles.connectedButton : 
                  (isCurrentlyConnecting || isCurrentlyConnected) ? styles.connectingButton : null,
                ]}
                onPress={() => handleConnect(item)}
                disabled={isConnected || isCurrentlyConnecting || isCurrentlyConnected}
              >
                <Text style={styles.connectButtonText}>
                  {isConnected ? "Connected" : 
                   isCurrentlyConnecting ? "Connecting..." : 
                   isCurrentlyConnected ? "Connected" : "Connect"}
                </Text>
                {isConnected && (
                  <Ionicons name="checkmark-circle" size={14} color="#fff" style={styles.connectedIcon} />
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Modal Connecting */}
      <Modal visible={connecting} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync" size={50} color="#007AFF" />
            </Animated.View>
            <Text style={styles.connectingText}>Connecting to Device</Text>
            {connectingDevice && (
              <Text style={styles.deviceConnectingText}>{connectingDevice.name}</Text>
            )}
            <Text style={styles.pleaseWaitText}>Please wait...</Text>
          </View>
        </View>
      </Modal>

      {/* Modal Connected */}
      <Modal visible={connected} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={50} color="green" />
            <Text style={styles.connectedText}>Connected</Text>
            {connectingDevice && (
              <Text style={styles.deviceConnectedText}>{connectingDevice.name}</Text>
            )}
          </View>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingTop: Platform.select({ ios: 20, android: 20 }),
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "bold", marginLeft: 10 },
  tabs: { flexDirection: "row", marginBottom: 10 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#EAEAEA",
    marginRight: 10,
  },
  activeTab: { backgroundColor: "#007AFF" },
  tabText: { fontSize: 14, color: "#333" },
  activeTabText: { color: "#FFF", fontWeight: "bold" },
  scanningText: { fontSize: 14, color: "#666", marginBottom: 10 },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceImage: { width: 50, height: 50, marginRight: 10 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  deviceType: { fontSize: 12, color: "#666" },
  connectButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexShrink: 1,
    minWidth: 80,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  connectingButton: {
    backgroundColor: "#4d94ff",
  },
  connectedButton: {
    backgroundColor: "#28A745",
  },
  connectButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  connectedIcon: {
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    minWidth: 250,
  },
  connectingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
    marginTop: 15,
  },
  deviceConnectingText: {
    fontSize: 14,
    color: "#333",
    marginTop: 5,
  },
  pleaseWaitText: {
    fontSize: 14,
    color: "#666",
    marginTop: 15,
  },
  connectedText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
    marginTop: 15,
  },
  deviceConnectedText: {
    fontSize: 14,
    color: "#333",
    marginTop: 5,
  },
});