import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  Switch,
  Modal,
  FlatList
} from "react-native";
import axios from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';

const { width, height } = Dimensions.get("window");

const WEATHER_API_KEY = "137ea86a7cc8fd70e39b16ad03c010a4";
const CITY_NAME = "Chiang Rai";
const COUNTRY_CODE = "TH";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [showDeleteOption, setShowDeleteOption] = useState(false);
  
  // ใหม่: เพิ่ม state สำหรับ zones และ zoneModal
  const [zones, setZones] = useState([]);
  const [currentZone, setCurrentZone] = useState(null);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  
  const toggleDeviceStatus = (deviceId) => {
    setDevices((prevDevices) =>
      prevDevices.map((device) =>
        device._id === deviceId
          ? {
              ...device,
              status: device.status === "Online" ? "Offline" : "Online",
            }
          : device
      )
    );
  };
  
  const toggleDeleteMode = () => {
    setShowDeleteOption(!showDeleteOption);
  };

  useEffect(() => {
    fetchWeather();
    updateDate();
    // ใหม่: เรียกใช้ fetchZones แทนที่จะเรียก fetchDevices โดยตรง
    fetchZones();
  }, []);
  
  // ใหม่: ดึงข้อมูล Zone ของ User จาก MongoDB
  const fetchZones = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.error("No token found");
        return;
      }

      const response = await axios.get(API_ENDPOINTS.ZONES, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });

      console.log("📡 Zones Data:", response.data);

      if (response.data && response.data.zones) {
        setZones(response.data.zones);
        
        // ดึง current zone
        const currentZoneId = response.data.currentZoneId;
        if (currentZoneId) {
          const activeZone = response.data.zones.find(
            zone => zone._id === currentZoneId
          );
          if (activeZone) {
            setCurrentZone(activeZone);
          } else if (response.data.zones.length > 0) {
            setCurrentZone(response.data.zones[0]);
          }
        } else if (response.data.zones.length > 0) {
          setCurrentZone(response.data.zones[0]);
        }
        
        // หลังจากดึง zone แล้ว ดึงอุปกรณ์ในโซนนั้น
        await fetchDevices(currentZoneId);
      } else {
        // ถ้าไม่มี zone ให้ดึงอุปกรณ์ทั้งหมด
        await fetchDevices();
      }
    } catch (error) {
      console.error("❌ Error fetching zones:", error);
      // ถ้ามีปัญหาในการดึง zone ให้ดึงอุปกรณ์ทั้งหมด
      await fetchDevices();
    } finally {
      setLoading(false);
    }
  };
  
  // ใหม่: แก้ไขฟังก์ชัน fetchDevices เพื่อรองรับ zoneId
  const fetchDevices = async (zoneId = null) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.error("No token found");
        return;
      }

      // สร้าง URL ตาม zoneId
      let url = API_ENDPOINTS.DEVICES;
      if (zoneId) {
        url += `?zoneId=${zoneId}`;
      }

      const response = await axios.get(url, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });

      console.log("📡 Devices Data:", response.data);

      if (Array.isArray(response.data)) {
        // เมื่อเชื่อมต่อเสร็จแล้ว ให้กำหนดให้อุปกรณ์เป็น Online เสมอ
        const connectedDevices = response.data.map(device => ({
          ...device,
          status: "Online",
          battery: "85%"  // Added default battery level
        }));
        setDevices(connectedDevices);
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error("❌ Error fetching devices:", error);
      setDevices([]);
    }
  };
  
  // ใหม่: ฟังก์ชันสำหรับเปลี่ยน zone
  const handleZoneSelect = async (zone) => {
    try {
      setZoneModalVisible(false);
      if (zone._id === currentZone?._id) return;
      
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      
      // Switch to selected zone
      await axios.post(
        `${API_ENDPOINTS.ZONES}/${zone._id}/switch`,
        {},
        {
          headers: getAuthHeaders(token),
          timeout: API_TIMEOUT
        }
      );
      
      setCurrentZone(zone);
      await fetchDevices(zone._id);
    } catch (error) {
      console.error('Error switching zone:', error);
      Alert.alert(t("Error"), t("Failed to switch zone. Please try again."));
    } finally {
      setLoading(false);
    }
  };
  
  // ใหม่: นำทางไปยังหน้าเพิ่ม Zone
  const navigateToAddZone = () => {
    router.push('/features/add-zone');
  };

  // ฟังก์ชันลบอุปกรณ์
  const handleDeleteDevice = async (deviceId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User is not logged in");
        return;
      }

      const response = await axios.delete(`${API_ENDPOINTS.DEVICES}/${deviceId}`, {
        headers: getAuthHeaders(token),
        timeout: API_TIMEOUT
      });

      if (response.status === 200) {
        Alert.alert("Success", "Device removed successfully");
        setDevices(devices.filter((device) => device._id !== deviceId));
      }
    } catch (error) {
      console.error("❌ Error deleting device:", error);
      Alert.alert("Error", "Failed to remove device");
    }
  };

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${CITY_NAME},${COUNTRY_CODE}&appid=${WEATHER_API_KEY}&units=metric`
      );
      setWeather(response.data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateDate = () => {
    const now = new Date();
    
    // Format for Thai date (16 มกราคม 2027)
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const thaiDate = now.toLocaleDateString('th-TH', options);
    
    setDate(thaiDate);
  };

  const getWeatherIcon = (condition) => {
    switch (condition) {
      case "Clear":
        return <Ionicons name="sunny" size={32} color="#FFA500" />;
      case "Rain":
        return <Ionicons name="rainy" size={32} color="#007AFF" />;
      case "Clouds":
        return <Ionicons name="cloud" size={32} color="#888888" />;
      case "Mist":
      case "Fog":
      case "Haze":
        return <Ionicons name="cloud-outline" size={32} color="#A9A9A9" />;
      case "Thunderstorm":
        return <Ionicons name="thunderstorm" size={32} color="#FF4500" />;
      case "Snow":
        return <Ionicons name="snow" size={32} color="#00BFFF" />;
      case "Tornado":
        return <Ionicons name="warning" size={32} color="#8B0000" />;
      default:
        return <Ionicons name="partly-sunny" size={32} color="#FFA500" />;
    }
  };
  
  // ใหม่: แสดง zone selector modal
  const renderZoneModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={zoneModalVisible}
      onRequestClose={() => setZoneModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('Select Zone')}</Text>
            <TouchableOpacity onPress={() => setZoneModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={zones}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.zoneItem,
                  currentZone?._id === item._id && styles.activeZoneItem
                ]}
                onPress={() => handleZoneSelect(item)}
              >
                <Text style={styles.zoneItemText}>{item.name}</Text>
                {currentZone?._id === item._id && (
                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <TouchableOpacity
                style={styles.addZoneButton}
                onPress={() => {
                  setZoneModalVisible(false);
                  navigateToAddZone();
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.addZoneText}>{t('Add New Zone')}</Text>
              </TouchableOpacity>
            }
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.zoneSelector}
            onPress={() => setZoneModalVisible(true)}
          >
            <Text style={styles.zoneText}>{currentZone?.name || 'Your Zone'}</Text>
            <Ionicons name="chevron-down" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/notifications/notification")}>
            <Ionicons name="notifications-outline" size={24} color="black" />
          </TouchableOpacity>
        </View>

        {/* วันที่ */}
        <Text style={styles.dateText}>{date}</Text>

        {/* Weather Widget */}
        <View style={styles.weatherWidget}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : weather ? (
            <>
              <View style={styles.weatherHeader}>
                <View style={styles.weatherRow}>
                  {getWeatherIcon(weather.weather[0].main)}
                  <Text style={styles.weatherCondition}>
                  {t(weather.weather[0].main.toLowerCase())}
                  </Text>
                </View>
                <View>
                  <Text style={styles.weatherCity}>
                    <Ionicons name="location-outline" size={16} color="gray" />{" "}
                    {CITY_NAME}
                  </Text>
                </View>
              </View>

              <Text style={styles.temperature}>
                {Math.round(weather.main.temp)}°C
              </Text>

              <View style={styles.weatherDetails}>
                <Text style={styles.feelsLike}>
                  <Ionicons name="thermometer-outline" size={16} color="gray" />{" "}
                  Feels like {Math.round(weather.main.feels_like)}°C
                </Text>
                <Text style={styles.humidity}>
                  <Ionicons name="water-outline" size={16} color="#007AFF" />{" "}
                  {weather.main.humidity}%
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.errorText}> {t("Failed to load weather data")}</Text>
          )}
        </View>


        {/* Your Device Section */}
        <View style={styles.deviceSection}>
          <Text style={styles.sectionTitle}>{t("Your Device")}</Text>
          <TouchableOpacity onPress={toggleDeleteMode}>
            <MaterialIcons name={showDeleteOption ? "close" : "more-horiz"} size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Device List */}
        {devices.length === 0 ? (
          <View style={styles.noDevice}>
            <Image
              source={require("../assets/no-device.png")}
              style={styles.noDeviceImage}
            />
            <Text style={styles.noDeviceText}>{t("no_device")}</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => (
              <TouchableOpacity
                key={device._id}
                style={styles.deviceCard}
                onPress={() => router.push("/devices/device-monitor")}
                activeOpacity={0.7}
              >
                {showDeleteOption && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDevice(device._id)}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                
                <Image source={{ uri: device.image }} style={styles.deviceImage} />
                
                <View style={styles.deviceContent}>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <TouchableOpacity>
                      <MaterialIcons name="more-horiz" size={20} color="#333" />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.deviceSubtitle}>Connected</Text>
                  
                  <View style={styles.deviceInfo}>
                    <View style={styles.batteryInfo}>
                      <Ionicons name="battery-half-outline" size={16} color="#333" />
                      <Text style={styles.batteryText}>{device.battery}</Text>
                    </View>
                    
                    <View style={styles.statusContainer}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Online</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.deviceType}>Temperature sensor</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add Device Button */}
        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={() => router.push("/devices/selectdevice")}
        >
          <Ionicons name="add" size={22} color="white" />
          <Text style={styles.addDeviceText}>{t("Add device")}</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Zone Selector Modal */}
      {renderZoneModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f7fa",
    padding: 16
  },
  scrollContainer: {
    paddingBottom: 20
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10
  },
  zoneSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneText: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 4,
    color: "#333"
  },
  dateText: { 
    fontSize: 16, 
    fontWeight: "500",
    color: "#333", 
    marginBottom: 16 
  },
  weatherWidget: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 20,
  },
  weatherHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherCondition: { fontSize: 18, fontWeight: "bold", marginLeft: 8 },
  weatherDate: { fontSize: 14, color: "#666", textAlign: "right" },
  weatherCity: { fontSize: 14, color: "#444", textAlign: "right" },

  temperature: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 10,
  },
  weatherDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  feelsLike: { fontSize: 14, color: "#666" },
  humidity: { fontSize: 14, color: "#007AFF" },
  deviceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: "#333" 
  },
  deviceList: {
    marginBottom: 20,
  },
  deviceCard: {
    flexDirection: 'row',
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    width: '100%',
  },
  
  deviceImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  
  deviceContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  deviceName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  
  deviceSubtitle: {
    fontSize: 14,
    color: "#888",
    marginVertical: 2,
  },
  
  deviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginVertical: 4,
  },
  
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  batteryInfo: {
    position: "absolute",
    top: -13,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statusDot: {
    position: "absolute",
    top:10,
    right: 55,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  
  statusText: {
    position: "absolute",
    top: 6,
    right: 20,
    fontSize: 12,
    color: "#4CAF50",
  },
  
  batteryText: {
    fontSize: 12,
    color: "#777",
    marginLeft: 4,
  },
  
  deviceType: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  deleteButton: {
    position: "absolute",
    top: -13,
    left: 2,
    backgroundColor: "#FE5959",
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  noDevice: { 
    alignItems: "center", 
    marginVertical: 20 
  },
  noDeviceImage: { 
    width: 200, 
    height: 200, 
    marginBottom: 10 
  },
  noDeviceText: { 
    fontSize: 16, 
    color: "#777" 
  },
  addDeviceButton: {
    flexDirection: "row",
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  addDeviceText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFF",
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  zoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activeZoneItem: {
    backgroundColor: '#F5F8FF',
  },
  zoneItemText: {
    fontSize: 16,
  },
  addZoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  addZoneText: {
    fontSize: 16,
    color: '#3B82F6',
    marginLeft: 8,
  },
  deviceInfo: {
    position: 'relative',
    height: 24,
  },
});