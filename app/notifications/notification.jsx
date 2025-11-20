import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthHeaders, ANOMALY_ENDPOINTS, API_ENDPOINTS, AnomalyService } from '../utils/config/api';
import notificationService from '../utils/NotificationService';
import NotificationSettings from '../components/NotificationSettings';
import SwipeableNotification from '../components/SwipeableNotification';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const filters = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "critical", label: "Critical", icon: "warning-outline" },
  { id: "warning", label: "Warning", icon: "alert-outline" },
  { id: "info", label: "Info", icon: "information-circle-outline" },
];

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    throw error;
  }
};

export default function NotificationScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    loadNotifications();
    loadAnomalyStats();
    checkPushToken();
    
    const subscription = notificationService.setupNotificationListeners();
    
    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, []);

  // ✅ Reload เมื่อกลับมาที่หน้านี้
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const checkPushToken = async () => {
    try {
      const token = await notificationService.getCurrentToken();
      setPushToken(token);
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  };

  const loadAnomalyStats = async () => {
    try {
      const token = await getAuthToken();
      const stats = await AnomalyService.getStats(token, 30); 

      if (stats.success) {
        setAnomalyStats(stats.data);
      }
    } catch (error) {
      console.error('[Notification] Error loading anomaly stats:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      
      console.log('[Notification] 🔍 Fetching unresolved anomalies from API...');
      
      // ✅ เอาเฉพาะ anomalies ที่ยังไม่ resolve
      const response = await AnomalyService.getHistory(token, {
        limit: 100,
        page: 1,
        resolved: false  // ✅ สำคัญมาก!
      });
      
      console.log('[Notification] 📦 API Response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data?.anomalies) {
        const anomaliesArray = response.data.anomalies;
        
        console.log(`[Notification] ✅ Found ${anomaliesArray.length} unresolved anomalies`);
        
        if (anomaliesArray.length > 0) {
          console.log(`[Notification] 📄 First anomaly sample:`, JSON.stringify(anomaliesArray[0], null, 2));
        }
        
        const formattedNotifications = anomaliesArray.map((anomaly, index) => {
          const detectionMethod = anomaly?.detectionMethod || 
                                 anomaly?.detection_method || 
                                 'unknown';
          
          const isML = detectionMethod === 'ml_based' || 
                      detectionMethod === 'hybrid' ||
                      anomaly?.mlResults?.confidence > 0.5 ||
                      anomaly?.anomalyType === 'ml_detected' ||
                      anomaly?.type === 'ml_detected';
          
          const message = anomaly?.message || 
                         anomaly?.alertMessage?.message ||
                         anomaly?.details ||
                         `${anomaly?.anomalyType || anomaly?.type || 'Alert'} detected on ${anomaly?.deviceId || 'Unknown Device'}`;
          
          const alertLevel = anomaly?.alertLevel || 
                            anomaly?.alert_level ||
                            anomaly?.summary?.alertLevel || 
                            'yellow';
          
          let sensorData = anomaly?.sensorData || 
                          anomaly?.sensor_data ||
                          anomaly?.data ||
                          null;
          
          if (sensorData && typeof sensorData === 'object') {
            const hasData = Object.values(sensorData).some(val => 
              val !== null && val !== undefined
            );
            if (!hasData) {
              sensorData = null;
            }
          }
          
          if (index < 3) {
            console.log(`[Notification] 🔸 Anomaly ${index}:`, {
              id: anomaly._id,
              anomalyType: anomaly?.anomalyType,
              detectionMethod,
              isML,
              alertLevel,
              deviceId: anomaly?.deviceId,
              hasSensorData: !!sensorData,
              message: message.substring(0, 50) + '...'
            });
          }
          
          return {
            id: anomaly._id,
            title: getAnomalyTitle(anomaly.anomalyType || anomaly.type),
            message: message,
            location: anomaly.device_name || anomaly.deviceId || "Unknown Device",  
            type: getSeverityType(alertLevel),
            time: formatTime(anomaly.timestamp),
            date: formatDate(anomaly.timestamp),
            isRead: false,  // ✅ unresolved = ยังไม่อ่าน
            severity: alertLevel,
            confidence_score: anomaly.mlResults?.confidence,
            status: 'unresolved',  // ✅ ตั้งค่าตายตัว
            deviceId: anomaly.deviceId,
            anomaly_data: sensorData,
            resolved_at: null,
            resolved_by: null,
            resolution_notes: null,
            timestamp: anomaly.timestamp,
            isPushNotification: false,
            isML: isML,
            detectionMethod: detectionMethod,
            canDelete: false  // ✅ anomalies จาก DB ลบไม่ได้
          };
        });

        console.log(`[Notification] ✨ Formatted ${formattedNotifications.length} notifications`);
        console.log(`[Notification] 🤖 ML anomalies: ${formattedNotifications.filter(n => n.isML).length}`);
        console.log(`[Notification] 📊 With sensor data: ${formattedNotifications.filter(n => n.anomaly_data).length}`);

        const sortedNotifications = formattedNotifications.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );

        // ✅ รวมกับ local notifications (push notifications)
        const localNotifications = await getLocalNotifications();
        const allNotifications = [...sortedNotifications, ...localNotifications]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`[Notification] 🎉 Total notifications: ${allNotifications.length}`);
        console.log(`[Notification] 📱 Local (push): ${localNotifications.length}`);
        console.log(`[Notification] 🗄️ Database: ${sortedNotifications.length}`);
        
        setNotifications(allNotifications);
      } else {
        console.warn('[Notification] ⚠️ No anomalies in response or invalid structure');
        console.log('[Notification] Response structure:', JSON.stringify(response, null, 2));
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      }
    } catch (error) {
      console.error('[Notification] ❌ Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
      
      try {
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      } catch (localError) {
        console.error('[Notification] ❌ Error loading local notifications:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityType = (alertLevel) => {
    switch (alertLevel) {
      case 'red':
        return 'critical';
      case 'yellow':
        return 'warning';
      case 'green':
      default:
        return 'info';
    }
  };

  const getLocalNotifications = async () => {
    try {
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      if (storedNotifications) {
        const localNotifs = JSON.parse(storedNotifications);
        return localNotifs.map(notif => ({
          ...notif,
          isPushNotification: true,
          type: getSeverityType(notif.data?.alertLevel || 'yellow'),
          severity: notif.data?.alertLevel || 'yellow',
          time: formatTime(notif.timestamp),
          date: formatDate(notif.timestamp),
          location: notif.data?.device_name || 'Push Notification',
          isRead: notif.read || false,
          canDelete: true  // ✅ local notifications ลบได้
        }));
      }
    } catch (error) {
      console.error('[Notification] Error loading local notifications:', error);
    }
    return [];
  };

  const getAnomalyTitle = (type) => {
    const titleMap = {
      'sudden_drop': 'Sudden Value Drop',
      'sudden_spike': 'Sudden Value Spike',
      'constant_value': 'Constant Values',
      'missing_data': 'Missing Data',
      'vpd_too_low': 'VPD Too Low',
      'vpd_too_high': 'VPD Too High',
      'low_voltage': 'Low Voltage Alert',
      'high_fluctuation': 'High Fluctuation',
      'dew_point_close': 'Dew Point Alert',
      'battery_depleted': 'Battery Depleted',
      'ml_detected': 'Unusual Pattern Detected', 
      'temperature_high': 'High Temperature Alert',
      'temperature_low': 'Low Temperature Alert',
      'humidity_high': 'High Humidity Alert',
      'humidity_low': 'Low Humidity Alert',
      'sensor_malfunction': 'Sensor Malfunction',
      'data_anomaly': 'Data Error',
      'pattern_deviation': 'Pattern Deviation',
      'connection_lost': 'WiFi Connection Lost',
      'battery_low': 'Battery Low',
      'test': 'Test Notification'
    };
    
    return titleMap[type] || 'System Alert';
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
  };

  const formatDate = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    await loadAnomalyStats();
    await checkPushToken();
    setRefreshing(false);
  }, []);

  const filteredNotifications = notifications.filter(item => {
    if (selectedFilter === "all") return true;
    return item.type === selectedFilter;
  });

  const getBackgroundColor = (type, isRead) => {
    if (isRead) return "#FFFFFF";
    
    switch (type) {
      case "critical":
        return "#FFF5F5";
      case "warning":
        return "#FFFBF0";
      case "info":
        return "#F0F9FF";
      default:
        return "#FFFFFF";
    }
  };

  const getIcon = (title, type) => {
    if (title.includes("Temperature")) {
      return <Ionicons name="alert" size={24} color="#FFFFFF" />;
    } else if (title.includes("Battery")) {
      return <Ionicons name="battery-half" size={24} color="#FFFFFF" />;
    } else if (title.includes("Unusual Pattern") || title.includes("AI")) {
      return <Ionicons name="analytics" size={24} color="#FFFFFF" />;
    } else if (title.includes("VPD")) {
      return <Ionicons name="alert" size={24} color="#FFFFFF" />;
    } else if (title.includes("Sensor")) {
      return <Ionicons name="alert" size={24} color="#FFFFFF" />;
    } else if (title.includes("Humidity")) {
      return <Ionicons name="water" size={24} color="#FFFFFF" />;
    } else if (title.includes("Voltage")) {
      return <Ionicons name="flash" size={24} color="#FFFFFF" />;
    } else {
      return <Ionicons name="warning" size={24} color="#FFFFFF" />;
    }
  };

  const getIconBackground = (type) => {
    switch (type) {
      case "critical":
        return "#EF4444";
      case "warning":
        return "#F59E0B";
      case "info":
        return "#3B82F6";
      default:
        return "#9CA3AF";
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    setMenuVisible(false);
  };
  
  // ✅ แก้ไขให้ resolve แล้วหายจากหน้า notification
  const handleResolveNotification = async (id, isPushNotification) => {
    try {
      if (isPushNotification) {
        await markLocalNotificationAsRead(id);
        // ✅ ลบออกจาก state ทันที
        setNotifications(notifications.filter(n => n.id !== id));
      } else {
        const token = await getAuthToken();
        const result = await AnomalyService.resolveAnomaly(token, id, 'Resolved by user');
        
        if (result.success) {
          // ✅ ลบออกจาก state ทันที (เพราะหน้านี้แสดงแค่ unresolved)
          setNotifications(notifications.filter(n => n.id !== id));
          Alert.alert('Success', 'Notification marked as resolved');
        } else {
          Alert.alert('Error', result.message || 'Failed to resolve notification');
        }
      }
    } catch (error) {
      console.error('[Notification] Error resolving notification:', error);
      Alert.alert('Error', 'Failed to resolve notification');
    }
  };

  const markLocalNotificationAsRead = async (id) => {
    try {
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      if (storedNotifications) {
        const notifications = JSON.parse(storedNotifications);
        const updatedNotifications = notifications.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        );
        await AsyncStorage.setItem('localNotifications', JSON.stringify(updatedNotifications));
      }
    } catch (error) {
      console.error('[Notification] Error marking local notification as read:', error);
    }
  };

  // ✅ แก้ให้ลบได้เฉพาะ local notifications
  const handleDeleteNotification = (notification) => {
    // ❌ Anomalies จาก database ลบไม่ได้
    if (!notification.canDelete) {
      Alert.alert(
        'Cannot Delete',
        'Anomaly notifications from the database cannot be deleted. You can mark them as resolved instead.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Resolve',
            onPress: () => handleResolveNotification(notification.id, notification.isPushNotification)
          }
        ]
      );
      return;
    }

    // ✅ Local notifications ลบได้
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            await deleteLocalNotification(notification.id);
            setNotifications(notifications.filter(item => item.id !== notification.id));
          },
          style: "destructive"
        }
      ]
    );
  };

  const deleteLocalNotification = async (id) => {
    try {
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      if (storedNotifications) {
        const notifications = JSON.parse(storedNotifications);
        const updatedNotifications = notifications.filter(notif => notif.id !== id);
        await AsyncStorage.setItem('localNotifications', JSON.stringify(updatedNotifications));
      }
    } catch (error) {
      console.error('[Notification] Error deleting local notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // ✅ ถาม confirmation ก่อน
      Alert.alert(
        'Mark All as Resolved',
        'This will resolve all anomaly notifications. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resolve All',
            onPress: async () => {
              // ✅ Resolve ทุก anomaly
              const token = await getAuthToken();
              const anomalyNotifs = notifications.filter(n => !n.isPushNotification);
              
              for (const notif of anomalyNotifs) {
                try {
                  await AnomalyService.resolveAnomaly(token, notif.id, 'Bulk resolved by user');
                } catch (error) {
                  console.error(`Failed to resolve ${notif.id}:`, error);
                }
              }
              
              // ✅ Mark local notifications as read
              const storedNotifications = await AsyncStorage.getItem('localNotifications');
              if (storedNotifications) {
                const localNotifications = JSON.parse(storedNotifications);
                const updatedLocalNotifications = localNotifications.map(notif => ({ ...notif, read: true }));
                await AsyncStorage.setItem('localNotifications', JSON.stringify(updatedLocalNotifications));
              }
              
              // ✅ Clear ทั้งหมด
              setNotifications([]);
              setMenuVisible(false);
              Alert.alert('Success', 'All notifications have been resolved');
            }
          }
        ]
      );
    } catch (error) {
      console.error('[Notification] Error marking all as read:', error);
      Alert.alert('Error', 'Failed to resolve notifications');
    }
  };

  const deleteAllNotifications = () => {
    Alert.alert(
      "Delete All Notifications",
      "This will only delete local push notifications. Anomaly notifications will remain in the database.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete Local Only",
          onPress: async () => {
            try {
              await AsyncStorage.setItem('localNotifications', JSON.stringify([]));
              // ✅ ลบเฉพาะ local notifications
              setNotifications(notifications.filter(n => !n.isPushNotification));
              setMenuVisible(false);
              Alert.alert('Success', 'Local notifications deleted');
            } catch (error) {
              console.error('[Notification] Error deleting notifications:', error);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleNotificationPress = async (notification) => {
    // ✅ Mark as read when opened
    if (!notification.isRead) {
      if (notification.isPushNotification) {
        await markLocalNotificationAsRead(notification.id);
      }
      
      // ✅ อัพเดท state เพื่อลบไฮไลท์
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, isRead: true } : n
      ));
    }
    
    // Navigate to detail
    if (notification.isPushNotification) {
      if (notification.data?.anomalyId) {
        router.push({
          pathname: "/sensor-detail",
          params: {
            deviceId: notification.data.deviceId,
            anomalyId: notification.data.anomalyId
          }
        });
      }
    } else {
      router.push({
        pathname: "/devices/sensor-detail",
        params: {
          device: JSON.stringify({
            _id: notification.deviceId,
            name: notification.location
          })
        }
      });
    }
  };

  const sendTestPushNotification = async () => {
    try {
      await notificationService.sendTestNotification();
      Alert.alert('Test Sent', 'Local test notification sent');
    } catch (error) {
      console.error('[Notification] Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };
  
  const renderNotificationItem = ({ item }) => (
    <SwipeableNotification
      item={item}
      onPress={handleNotificationPress}
      onDelete={handleDeleteNotification}
      onResolve={handleResolveNotification}
      getBackgroundColor={getBackgroundColor}
      getIconBackground={getIconBackground}
      getIcon={getIcon}
      getSeverityColor={(severity) => {
        switch (severity) {
          case 'critical': return '#D32F2F';
          case 'high': return '#F57C00';
          case 'medium': return '#FFA000';
          case 'low': return '#388E3C';
          default: return '#FF9800';
        }
      }}
      editMode={editMode}
    />
  );
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification</Text>
          <TouchableOpacity style={styles.moreButton} onPress={() => setMenuVisible(true)}>
            <MaterialIcons name="more-horiz" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedFilter === filter.id && styles.selectedFilter,
              ]}
              onPress={() => setSelectedFilter(filter.id)}
              disabled={editMode}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={selectedFilter === filter.id ? "white" : "#666"}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter.id && styles.selectedFilterText,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No notifications</Text>
                <Text style={styles.emptySubtext}>
                  {selectedFilter === "all" 
                    ? "You're all caught up!" 
                    : `No ${selectedFilter} notifications`
                  }
                </Text>
              </View>
            }
          />
        )}

        {/* More Options Menu */}
        <Modal
          visible={menuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setMenuVisible(false)}
          >
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={toggleEditMode}
              >
                <Text style={styles.menuItemText}>{editMode ? "Done" : "Edit"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setSettingsVisible(true);
                }}
              >
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={markAllAsRead}
              >
                <Text style={styles.menuItemText}>Resolve All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onRefresh();
                }}
              >
                <Text style={styles.menuItemText}>Refresh</Text>
              </TouchableOpacity>
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={deleteAllNotifications}
              >
                <Text style={[styles.menuItemText, styles.dangerText]}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Notification Settings Modal */}
        <Modal
          visible={settingsVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSettingsVisible(false)}
        >
          <NotificationSettings onClose={() => setSettingsVisible(false)} />
        </Modal>
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF",
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 4,
  },
  moreButton: {
    padding: 4,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: "600",
    flex: 1,
    marginLeft: 12,
    color: "#111827",
  },
  filterContainer: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  filterButton: { 
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  selectedFilter: { 
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  filterText: { 
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  selectedFilterText: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginTop: 60,
    marginRight: 16,
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: '#111827',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  dangerText: {
    color: '#EF4444',
  },
});