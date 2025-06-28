import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  RefreshControl
} from "react-native";
import axios from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';
import WeatherWidget from "../components/WeatherWidget"; 

// Device images mapping 
const deviceImages = {
  "sensor.png": require("../assets/sensor.png"),
  "sensor2.png": require("../assets/sensor2.png"),
  "sensor3.png": require("../assets/sensor3.png"),
  "sensor4.png": require("../assets/sensor4.png"),
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState("");
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [showDeleteOption, setShowDeleteOption] = useState(false);
  
  const [zones, setZones] = useState([]);
  const [currentZone, setCurrentZone] = useState(null);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [hasSelectedZone, setHasSelectedZone] = useState(false);
  
  const [deviceMenuVisible, setDeviceMenuVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  
  const toggleDeleteMode = () => {
    setShowDeleteOption(!showDeleteOption);
  };

  // Get device image from local assets based on filename
  const getDeviceImage = (imageFileName) => {
    return deviceImages[imageFileName] || deviceImages["sensor.png"];
  };

  // Manual refresh function
  const handleRefresh = async () => {
    console.log("🔄 Manual refresh triggered");
    if (hasSelectedZone && currentZone) {
      await fetchDevices(currentZone._id);
    } else {
      await fetchDevices();
    }
  };

  // Handle adding a new device
  const handleAddDevice = () => {
    if (zones.length === 0) {
      Alert.alert(
        "Zone Required",
        "Please create a zone first before adding IoT devices. Zones help organize and manage your devices efficiently.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Create Zone",
            onPress: () => router.push("/features/add-zone")
          }
        ]
      );
    } else {
      router.push("/devices/selectdevice");
    }
  };

  useEffect(() => {
    updateDate();
    fetchZones();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    let refreshInterval;
    
    if (hasSelectedZone && currentZone) {
      refreshInterval = setInterval(() => {
        console.log("🔄 Auto-refreshing devices data...");
        fetchDevices(currentZone._id);
      }, 30000); // 30 seconds
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [hasSelectedZone, currentZone]);
  
  // ✅ เพิ่ม console.log เพื่อ debug
  console.log("🔍 Debug info:", {
    zonesLength: zones.length,
    hasSelectedZone: hasSelectedZone,
    currentZone: currentZone?.name || "null"
  });

  const fetchZones = async () => {
    try {
      setLoading(true);
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
        const userCreatedZones = response.data.zones.filter(zone => !zone.isDefault);
        setZones(userCreatedZones);
        
        const currentZoneId = response.data.currentZoneId;
        if (currentZoneId) {
          const activeZone = response.data.zones.find(
            zone => zone._id === currentZoneId
          );
          if (activeZone) {
            setCurrentZone(activeZone);
            setHasSelectedZone(true);
          } else if (userCreatedZones.length > 0) {
            setCurrentZone(userCreatedZones[0]);
            setHasSelectedZone(true);
          } else {
            setHasSelectedZone(false);
          }
        } else if (userCreatedZones.length > 0) {
          setCurrentZone(userCreatedZones[0]);
          setHasSelectedZone(true);
        } else {
          setHasSelectedZone(false);
        }
        
        await fetchDevices(currentZoneId);
      } else {
        setHasSelectedZone(false);
        await fetchDevices();
      }
    } catch (error) {
      console.error("❌ Error fetching zones:", error);
      setHasSelectedZone(false);
      await fetchDevices();
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDevices = async (zoneId = null) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.error("No token found");
        return;
      }

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
        const connectedDevices = await Promise.all(response.data.map(async (device) => {
          try {
            const dataResponse = await axios.get(`${API_ENDPOINTS.DEVICES}/${device._id}/data?limit=1`, {
              headers: getAuthHeaders(token),
              timeout: API_TIMEOUT
            });

            console.log(`📊 Latest data for ${device.name}:`, dataResponse.data);

            let latestReading = null;
            let dataCount = 0;

            if (dataResponse.data && dataResponse.data.data && dataResponse.data.data.length > 0) {
              const latest = dataResponse.data.data[0];
              latestReading = {
                temperature: latest.temperature,
                humidity: latest.humidity,
                timestamp: latest.timestamp
              };
              dataCount = dataResponse.data.totalRecords || dataResponse.data.data.length;
            }

            return {
              ...device,
              status: device.status || "Online",
              battery: device.battery || "85%",
              dataCount: dataCount,
              lastReading: latestReading 
            };
          } catch (deviceError) {
            console.error(`❌ Error fetching data for device ${device._id}:`, deviceError);
            // Fallback to original device data if API call fails
            return {
              ...device,
              status: device.status || "Online",
              battery: device.battery || "85%",
              dataCount: device.dataCount || 0,
              lastReading: device.lastReading || null
            };
          }
        }));
        
        setDevices(connectedDevices);
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error("❌ Error fetching devices:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await AsyncStorage.removeItem("token");
        Alert.alert("Session Expired", "Please log in again.");
        router.replace("/auth/sign-in");
      }
      setDevices([]);
    }
  };
  
  const handleZoneSelect = async (zone) => {
    try {
      setZoneModalVisible(false);
      if (zone._id === currentZone?._id) return;
      
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      
      await axios.post(
        `${API_ENDPOINTS.ZONES}/${zone._id}/switch`,
        {},
        {
          headers: getAuthHeaders(token),
          timeout: API_TIMEOUT
        }
      );
      
      setCurrentZone(zone);
      setHasSelectedZone(true);
      await fetchDevices(zone._id);
    } catch (error) {
      console.error('Error switching zone:', error);
      Alert.alert(t("Error"), t("Failed to switch zone. Please try again."));
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteZone = async (zone) => {
    try {
      const isCurrentZone = currentZone && zone._id === currentZone._id;

      Alert.alert(
        t("Delete Zone"),
        t("Are you sure you want to delete this zone?"),
        [
          {
            text: t("Cancel"),
            style: "cancel"
          },
          {
            text: t("Delete"),
            style: "destructive",
            onPress: async () => {
              const token = await AsyncStorage.getItem("token");
              
              await axios.delete(
                `${API_ENDPOINTS.ZONES}/${zone._id}`,
                {
                  headers: getAuthHeaders(token),
                  timeout: API_TIMEOUT
                }
              );
              
              const updatedZones = zones.filter(z => z._id !== zone._id);
              setZones(updatedZones);
              
              if (isCurrentZone) {
                if (updatedZones.length > 0) {
                  await handleZoneSelect(updatedZones[0]);
                } else {
                  setCurrentZone(null);
                  setHasSelectedZone(false);
                  await fetchDevices();
                }
              }
              
              Alert.alert(t("Success"), t("Zone deleted successfully"));
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting zone:', error);
      Alert.alert(t("Error"), t("Failed to delete zone. Please try again."));
    }
  };
  
  const navigateToAddZone = () => {
    router.push('/features/add-zone');
  };

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
      if (error.response?.status === 401 || error.response?.status === 403) {
        await AsyncStorage.removeItem("token");
        Alert.alert("Session Expired", "Please log in again.");
        router.replace("/auth/sign-in");
      } else {
        Alert.alert("Error", "Failed to remove device");
      }
    }
  };

  const handleShowDeviceMenu = (device, event) => {
    setMenuPosition({
      top: event.nativeEvent.pageY - 80,
      right: 30
    });
    setSelectedDevice(device);
    setDeviceMenuVisible(true);
  };

  const handleEditDevice = () => {
    setDeviceMenuVisible(false);
    if (selectedDevice) {
      router.push({
        pathname: "/devices/edit-device", 
        params: { deviceId: selectedDevice._id, deviceName: selectedDevice.name }
      });
    }
  };

  const updateDate = () => {
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const engDate = now.toLocaleDateString('en-EN', options);
    setDate(engDate);
  };
  
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
      
          {zones.length > 0 ? (
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
                  <View style={styles.zoneItemActions}>
                    {currentZone?._id === item._id && (
                      <Ionicons name="checkmark" size={20} color="#3B82F6" style={styles.checkIcon} />
                    )}
                    <TouchableOpacity 
                      onPress={() => handleDeleteZone(item)}
                      style={styles.deleteZoneButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.noZonesContainer}>
              <Text style={styles.noZonesText}>{t("No zones found")}</Text>
            </View>
          )}
          
          {/* Add New Zone Button */}
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
        </View>
      </View>
    </Modal>
  );

  const renderDeviceMenuModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={deviceMenuVisible}
      onRequestClose={() => setDeviceMenuVisible(false)}
    >
      <TouchableOpacity 
        style={styles.menuModalOverlay}
        activeOpacity={1}
        onPress={() => setDeviceMenuVisible(false)}
      >
        <View 
          style={[
            styles.deviceMenuContainer, 
            { top: menuPosition.top, right: menuPosition.right }
          ]}
        >
          <TouchableOpacity 
            style={styles.deviceMenuItem}
            onPress={handleEditDevice}
          >
            <Text style={styles.deviceMenuItemText}>Edit Device</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.zoneSelector}
            onPress={() => setZoneModalVisible(true)}
          >
            <Text style={styles.zoneText}>
              {hasSelectedZone ? currentZone?.name : 'Your Zone'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push("/notifications/notification")}>
              <Ionicons name="notifications-outline" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Date and Sync Info */}
        <View style={styles.syncInfo}>
          <Text style={styles.dateText}>{date}</Text>
          {lastSyncTime && (
            <Text style={styles.syncText}>
              Last sync: {lastSyncTime}
            </Text>
          )}
        </View>
        
        <WeatherWidget />

        {/* Your Device Section */}
        <View style={styles.deviceSection}>
          <Text style={styles.sectionTitle}>{t("Your Device")}</Text>
          <TouchableOpacity onPress={toggleDeleteMode}>
            <MaterialIcons name={showDeleteOption ? "close" : "more-horiz"} size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Alert if no zones are available */}
        {zones.length === 0 && (
          <View style={styles.noZoneAlert}>
            <Ionicons name="information-circle-outline" size={24} color="#FF9500" />
            <Text style={styles.noZoneAlertText}>
              Create a zone first to organize your IoT devices efficiently
            </Text>
            <TouchableOpacity 
              style={styles.createZoneButton}
              onPress={() => router.push("/features/add-zone")}
            >
              <Text style={styles.createZoneButtonText}>Create Zone</Text>
            </TouchableOpacity>
          </View>
        )}

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
               onPress={() => router.push({
                 pathname: "/devices/device-monitor",
                 params: { device: JSON.stringify(device) }
               })}
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
               
               <Image source={getDeviceImage(device.image)} style={styles.deviceImage} />
               
               <View style={styles.deviceContent}>
                 <View style={styles.deviceHeader}>
                   <Text style={styles.deviceName}>{device.name}</Text>
                   <TouchableOpacity onPress={(event) => handleShowDeviceMenu(device, event)}>
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
                     <Text style={styles.statusText}>{device.status}</Text>
                   </View>
                 </View>
                 
                 <View style={styles.deviceMetrics}>
                   <Text style={styles.deviceType}>{device.type}</Text>
                   {device.lastReading && (
                     <View style={styles.lastReadingContainer}>
                       <Text style={styles.lastReadingText}>
                         Last: {device.lastReading.temperature}°C, {device.lastReading.humidity}%
                       </Text>
                       <Text style={styles.dataCountText}>
                         {device.dataCount} readings
                       </Text>
                     </View>
                   )}
                 </View>
               </View>
             </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add Device button */}
        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={handleAddDevice}
        >
          <Ionicons name="add" size={22} color="white" />
          <Text style={styles.addDeviceText}>{t("Add device")}</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Zone Selector Modal */}
      {renderZoneModal()}
      
      {/* Device Menu Modal */}
      {renderDeviceMenuModal()}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
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
  syncInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  dateText: { 
    fontSize: 16, 
    fontWeight: "500",
    color: "#333"
  },
  syncText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic"
  },
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
  noZoneAlert: {
    backgroundColor: "#FFF4E6",
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  noZoneAlertText: {
    flex: 1,
    fontSize: 14,
    color: "#D97706",
    marginLeft: 12,
    marginRight: 12,
  },
  createZoneButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createZoneButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
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
  
  deviceMetrics: {
    marginTop: 4,
  },
  
  lastReadingContainer: {
    marginTop: 4,
  },
  
  lastReadingText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  
  dataCountText: {
    fontSize: 11,
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
  noZonesContainer: {
    padding: 30,
    alignItems: 'center',
  },
  noZonesText: {
    fontSize: 16,
    color: '#777',
  },
  // ✅ ลบ disabledButton style ออก
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
  zoneItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 10,
  },
  deleteZoneButton: {
    padding: 5,
  },
  addZoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 10,
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
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  deviceMenuContainer: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 160,
  },
  deviceMenuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deviceMenuItemText: {
    fontSize: 16,
    color: '#333',
  }
});