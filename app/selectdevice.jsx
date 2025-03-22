import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Alert, Platform, ActivityIndicator, Animated, Easing 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = 'http://192.168.1.7:3000/api/devices';
// ที่อยู่ipของแต่ละเครื่อง (ipconfig) แล้วดูตรง IPv4 Address 
// ถ้าต่อผ่าน wifi ดูที่ Wireless LAN adapter Wi-Fi: IPv4 Address
// ถ้าต่อผ่าน LAN ดูที่ Ethernet adapter Ethernet: IPv4 Address
// http://<your-ip>:3000/api/devices

const devices = [
  { id: "1", name: "IBS-TH3", type: "Temperature & Humidity Sensor", image: require("./assets/sensor.png") },
  { id: "2", name: "IBS-TH4", type: "Temperature & Humidity Sensor", image: require("./assets/sensor2.png") },
  { id: "3", name: "IBS-TH5", type: "Temperature & Humidity Sensor", image: require("./assets/sensor3.png") },
  { id: "4", name: "IBS-TH6", type: "Temperature & Humidity Sensor", image: require("./assets/sensor4.png") },
];

export default function SelectDeviceScreen() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectingDevice, setConnectingDevice] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const params = useLocalSearchParams();
  const returnTo = params.returnTo;
  const [spinValue] = useState(new Animated.Value(0));
  
  // ตรวจสอบอุปกรณ์ที่เชื่อมต่อแล้วตอนเริ่มต้น
  useEffect(() => {
    fetchConnectedDevices();
  }, []);
  
  // ดึงข้อมูลอุปกรณ์ที่เชื่อมต่อแล้วจาก API
  const fetchConnectedDevices = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.error("No token found");
        setLoading(false);
        return;
      }

      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        // เก็บเฉพาะ deviceId ของอุปกรณ์ที่เชื่อมต่อแล้ว
        const connectedIds = response.data.map(device => device.deviceId);
        setConnectedDevices(connectedIds);
      }
    } catch (error) {
      console.error("Error fetching connected devices:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // สร้างอนิเมชันหมุน
  const startSpinning = () => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  };
  
  // แปลงค่าสำหรับการหมุน
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleConnect = async (device) => {
    setConnectingDevice(device);
    setConnecting(true);
    startSpinning();

    // จำลองเวลาในการเชื่อมต่อ
    setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem("token"); 
        if (!token) {
          Alert.alert("Error", "User is not logged in");
          setConnecting(false);
          return;
        }

        const response = await axios.post(
          API_URL,
          { 
            name: device.name, 
            type: device.type, 
            image: device.image, 
            deviceId: device.id
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log("✅ Device Connected:", response.data);
        
        // เพิ่มอุปกรณ์ที่เชื่อมต่อแล้วเข้าไปในรายการ
        setConnectedDevices(prev => [...prev, device.id]);
        
        // เปลี่ยนจากหน้า connecting เป็น connected
        setConnecting(false);
        setConnected(true);
        
        // หลังจากแสดงป๊อปอัพ connected จะนำทางกลับ
        setTimeout(() => {
          setConnected(false);
          if (returnTo === "statistics") {
            router.push("/tabs/statistics");
          } else {
            router.push("/tabs/home");
          }
        }, 1500);
        
      } catch (error) {
        console.error("❌ Error connecting device:", error);
        Alert.alert("Error", "Failed to connect device");
        setConnecting(false);
      }
    }, 2000); // จำลองการเชื่อมต่อ 2 วินาที
  };

  // ตรวจสอบว่าอุปกรณ์เชื่อมต่อแล้วหรือไม่
  const isDeviceConnected = (deviceId) => {
    return connectedDevices.includes(deviceId);
  };

  // แสดงสถานะการโหลดขณะกำลังตรวจสอบอุปกรณ์
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>กำลังตรวจสอบอุปกรณ์...</Text>
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
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Sensors</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Temperature</Text>
        </TouchableOpacity>
      </View>

      {/* Scanning Text */}
      <Text style={styles.scanningText}>🔍 Scanning for devices...</Text>

      {/* Device List */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }} // ป้องกันชนขอบล่าง
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
                  (isCurrentlyConnecting || isCurrentlyConnected) ? styles.connectingButton : null
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
            <Animated.View style={{transform: [{rotate: spin}]}}>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectingButton: {
    backgroundColor: "#4d94ff", // สีอ่อนลงเมื่อกำลังเชื่อมต่อ
  },
  connectedButton: {
    backgroundColor: "#28A745", // สีเขียวเมื่อเชื่อมต่อแล้ว
  },
  connectButtonText: { 
    color: "#FFF", 
    fontWeight: "bold"
  },
  connectedIcon: {
    marginLeft: 4,
  },

  modalContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "rgba(0,0,0,0.5)"
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