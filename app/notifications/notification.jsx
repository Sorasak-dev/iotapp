import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Alert,
  RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthHeaders, ANOMALY_ENDPOINTS, API_ENDPOINTS } from '../utils/config/api';
import notificationService from '../utils/NotificationService';
import NotificationSettings from '../components/NotificationSettings';

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

const AnomalyService = {
  getHistory: async (token, filters = {}) => {
    try {
      console.log('[Notification] Fetching anomaly history with filters:', filters);
      
      const queryParams = new URLSearchParams();
      if (filters.deviceId) queryParams.append('deviceId', filters.deviceId);
      if (filters.resolved !== undefined) queryParams.append('resolved', filters.resolved);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.alertLevel) queryParams.append('alertLevel', filters.alertLevel);
      if (filters.sort) queryParams.append('sort', filters.sort);
      
      const url = `${ANOMALY_ENDPOINTS.HISTORY}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[Notification] Anomaly history response:', result?.data?.anomalies?.length || 0, 'items');
      return result;
      
    } catch (error) {
      console.error('[Notification] Error fetching anomaly history:', error);
      return {
        success: true,
        data: {
          anomalies: [],
          pagination: { page: 1, limit: 20, total: 0 }
        }
      };
    }
  },

  getStats: async (token, days = 30) => {
    try {
      const url = `${ANOMALY_ENDPOINTS.STATS}?days=${days}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('[Notification] Error fetching stats:', error);
      return {
        success: true,
        data: {
          total_anomalies: 0,
          resolved_count: 0,
          unresolved_count: 0,
          alertStats: []
        }
      };
    }
  },

  resolveAnomaly: async (token, anomalyId, notes = '') => {
    try {
      const response = await fetch(ANOMALY_ENDPOINTS.RESOLVE(anomalyId), {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ notes }),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('[Notification] Error resolving anomaly:', error);
      throw error;
    }
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
      
      const response = await AnomalyService.getHistory(token, {
        limit: 100,
        sort: '-timestamp'
      });
      
      console.log('[Notification] Processing response...');
      
      if (response.success && response.data?.anomalies) {
        const anomaliesArray = response.data.anomalies;
        
        console.log(`[Notification] Found ${anomaliesArray.length} anomalies`);
        
        if (anomaliesArray.length > 0) {
          console.log(`[Notification] First anomaly:`, JSON.stringify(anomaliesArray[0], null, 2));
        }
        
        const formattedNotifications = anomaliesArray.map((anomaly, index) => {
          const detectionMethod = anomaly?.detectionMethod || 
                                 anomaly?.detection_method || 
                                 'unknown';
          
          const isML = detectionMethod === 'ml_based' || 
                      detectionMethod === 'hybrid' ||
                      anomaly?.mlResults?.confidence > 0 ||
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
            console.log(`[Notification] Anomaly ${index}:`, {
              anomalyType: anomaly?.anomalyType,
              detectionMethod,
              isML,
              alertLevel,
              hasSensorData: !!sensorData,
              message: message.substring(0, 50)
            });
          }
          
          return {
            id: anomaly._id,
            title: getAnomalyTitle(anomaly.anomalyType || anomaly.type),
            message: message,
            location: anomaly.deviceId || "Unknown Device",
            type: getSeverityType(alertLevel),
            time: formatTime(anomaly.timestamp),
            date: formatDate(anomaly.timestamp),
            isRead: anomaly.resolved,
            severity: alertLevel,
            confidence_score: anomaly.mlResults?.confidence,
            status: anomaly.resolved ? 'resolved' : 'unresolved',
            deviceId: anomaly.deviceId,
            anomaly_data: sensorData,
            resolved_at: anomaly.resolvedAt,
            resolved_by: anomaly.resolvedBy,
            resolution_notes: anomaly.notes,
            timestamp: anomaly.timestamp,
            isPushNotification: false,
            isML: isML,
            detectionMethod: detectionMethod
          };
        });

        console.log(`[Notification] Formatted ${formattedNotifications.length} notifications`);
        console.log(`[Notification] ML anomalies: ${formattedNotifications.filter(n => n.isML).length}`);
        console.log(`[Notification] With sensor data: ${formattedNotifications.filter(n => n.anomaly_data).length}`);

        const localNotifications = await getLocalNotifications();
        const allNotifications = [...formattedNotifications, ...localNotifications]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setNotifications(allNotifications);
      } else {
        console.warn('[Notification] No anomalies in response');
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      }
    } catch (error) {
      console.error('[Notification] Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
      
      try {
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      } catch (localError) {
        console.error('[Notification] Error loading local notifications:', localError);
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
          isRead: notif.read || false
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
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hours ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} days ago`;
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
        return "#FFEBEE";
      case "warning":
        return "#FFF3E0";
      case "info":
        return "#E3F2FD";
      default:
        return "#FFFFFF";
    }
  };

  const getIcon = (title, type) => {
    if (title.includes("WiFi") || title.includes("Connection")) {
      return <Ionicons name="wifi" size={24} color="#FF5722" />;
    } else if (title.includes("Battery")) {
      return <Ionicons name="battery-half" size={24} color="#FF9800" />;
    } else if (title.includes("Backup")) {
      return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
    } else if (title.includes("Data") || title.includes("Error")) {
      return <Ionicons name="close-circle" size={24} color="#2196F3" />;
    } else if (title.includes("Unusual Pattern") || title.includes("AI")) {
      return <Ionicons name="analytics" size={24} color="#FF9800" />; 
    } else {
      return <Ionicons name="warning" size={24} color="#FF5722" />;
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    setMenuVisible(false);
  };
  
  const handleResolveNotification = async (id, isPushNotification) => {
    try {
      if (isPushNotification) {
        await markLocalNotificationAsRead(id);
      } else {
        const token = await getAuthToken();
        await AnomalyService.resolveAnomaly(token, id, 'Resolved by user');
      }

      setNotifications(notifications.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true, status: 'resolved' }
          : notification
      ));
      
      Alert.alert('Success', 'Notification marked as resolved');
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

  const handleDeleteNotification = (id, isPushNotification) => {
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
            if (isPushNotification) {
              await deleteLocalNotification(id);
            }
            setNotifications(notifications.filter(item => item.id !== id));
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
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      if (storedNotifications) {
        const localNotifications = JSON.parse(storedNotifications);
        const updatedLocalNotifications = localNotifications.map(notif => ({ ...notif, read: true }));
        await AsyncStorage.setItem('localNotifications', JSON.stringify(updatedLocalNotifications));
      }
      
      setNotifications(
        notifications.map(notification => ({
          ...notification,
          isRead: true
        }))
      );
      setMenuVisible(false);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('[Notification] Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const deleteAllNotifications = () => {
    Alert.alert(
      "Delete All Notifications",
      "Are you sure you want to delete all notifications?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete All",
          onPress: async () => {
            try {
              await AsyncStorage.setItem('localNotifications', JSON.stringify([]));
              setNotifications([]);
              setMenuVisible(false);
            } catch (error) {
              console.error('[Notification] Error deleting all notifications:', error);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    if (notification.isPushNotification) {
      if (notification.data?.anomalyId) {
        router.push({
          pathname: "/sensor-detail",
          params: {
            deviceId: notification.data.deviceId,
            anomalyId: notification.data.anomalyId
          }
        });
      } else {
        handleResolveNotification(notification.id, true);
      }
    } else {
      router.push({
        pathname: "/sensor-detail",
        params: {
          deviceId: notification.deviceId,
          anomalyId: notification.id
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
    <TouchableOpacity 
      onPress={() => handleNotificationPress(item)}
      style={[
        styles.notificationContainer,
        { backgroundColor: getBackgroundColor(item.type, item.isRead) },
        item.isML && styles.mlNotification, 
      ]}
    >
      <View style={styles.notificationIcon}>
        {getIcon(item.title, item.type)}
      </View>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.notificationMessage} numberOfLines={2} ellipsizeMode="tail">
          {item.message || item.body}
        </Text>
        
        {item.anomaly_data && Object.keys(item.anomaly_data).some(key => 
          item.anomaly_data[key] !== null && item.anomaly_data[key] !== undefined
        ) && (
          <View style={styles.sensorDataPreview}>
            {item.anomaly_data.temperature !== undefined && item.anomaly_data.temperature !== null && (
              <Text style={styles.sensorText}>
                🌡️ {item.anomaly_data.temperature.toFixed(1)}°C
              </Text>
            )}
            {item.anomaly_data.humidity !== undefined && item.anomaly_data.humidity !== null && (
              <Text style={styles.sensorText}>
                💧 {item.anomaly_data.humidity.toFixed(1)}%
              </Text>
            )}
            {item.anomaly_data.vpd !== undefined && item.anomaly_data.vpd !== null && (
              <Text style={styles.sensorText}>
                📊 {item.anomaly_data.vpd.toFixed(2)} kPa
              </Text>
            )}
          </View>
        )}
        
        <View style={styles.notificationFooter}>
          <Ionicons name="location-outline" size={12} color="gray" />
          <Text style={styles.notificationLocation} numberOfLines={1} ellipsizeMode="tail">
            {item.location}
          </Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <Text style={styles.notificationTime}>{item.time}</Text>
        {!item.isRead && item.status !== 'resolved' && <View style={styles.unreadDot} />}
      </View>
      
      {editMode && (
        <View style={styles.actionButtons}>
          {(!item.isRead && item.status !== 'resolved') && (
            <TouchableOpacity 
              style={styles.resolveButton}
              onPress={() => handleResolveNotification(item.id, item.isPushNotification)}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="green" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleDeleteNotification(item.id, item.isPushNotification)}
          >
            <Ionicons name="trash-outline" size={24} color="red" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification</Text>
          <TouchableOpacity style={styles.moreOptions} onPress={() => setMenuVisible(true)}>
            <MaterialIcons name="more-horiz" size={24} color="black" />
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
                  selectedFilter === filter.id && { color: "white" },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="hourglass-outline" size={48} color="#666" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
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
                <Ionicons name="notifications-off-outline" size={48} color="#999" />
                <Text style={styles.emptyText}>
                  {selectedFilter === "all" 
                    ? "No notifications available" 
                    : `No ${selectedFilter} notifications`
                  }
                </Text>
                <TouchableOpacity 
                  style={styles.enableNotificationsButton}
                  onPress={() => setSettingsVisible(true)}
                >
                  <Text style={styles.enableNotificationsText}>
                    Configure Notifications
                  </Text>
                </TouchableOpacity>
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
                <Ionicons name={editMode ? "close-outline" : "create-outline"} size={20} color="black" />
                <Text style={styles.menuItemText}>{editMode ? "Done" : "Edit"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setSettingsVisible(true);
                }}
              >
                <Ionicons name="settings-outline" size={20} color="black" />
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={markAllAsRead}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="black" />
                <Text style={styles.menuItemText}>Mark All as Read</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={sendTestPushNotification}
              >
                <Ionicons name="send-outline" size={20} color="blue" />
                <Text style={[styles.menuItemText, { color: "blue" }]}>Send Test</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={deleteAllNotifications}
              >
                <Ionicons name="trash-outline" size={20} color="red" />
                <Text style={[styles.menuItemText, { color: "red" }]}>Delete All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onRefresh();
                }}
              >
                <Ionicons name="refresh-outline" size={20} color="black" />
                <Text style={styles.menuItemText}>Refresh</Text>
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  container: { 
    flex: 1, 
    backgroundColor: "#F9F9F9", 
    paddingHorizontal: 16,
  },

  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginVertical: 16, 
  },

  backButton: {
    padding: 8,
  },

  moreOptions: {
    padding: 8,
  },

  headerTitle: { 
    fontSize: 24, 
    fontWeight: "600",
    flex: 1,
    marginLeft: 8,
    color: "#000",
  },

  filterScroll: {
    flexGrow: 0,
  },
  
  filterContainer: {
    flexDirection: "row",
    paddingBottom: 16,
    marginBottom: 16,
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },

  filterButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16, 
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minWidth: 70,
    maxWidth: 85,
    justifyContent: "center",
    flex: 1,
    marginHorizontal: 2,
  },

  selectedFilter: { 
    backgroundColor: "#007BFF",
    borderColor: "#007BFF",
  },
  
  filterText: { 
    marginLeft: 4, 
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
    numberOfLines: 1,
  },
  
  listContent: {
    paddingBottom: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },

  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },

  enableNotificationsButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007BFF',
    borderRadius: 8,
  },

  enableNotificationsText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  notificationContainer: { 
    flexDirection: "row", 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 8, 
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  mlNotification: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  
  notificationIcon: { 
    marginRight: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
  },

  notificationText: { 
    flex: 1,
    paddingRight: 8,
  },

  notificationTitle: { 
    fontWeight: "600", 
    fontSize: 16,
    color: "#000",
    marginBottom: 4,
  },

  notificationMessage: { 
    fontSize: 14, 
    color: "#666",
    marginBottom: 8,
    lineHeight: 18,
  },

  sensorDataPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    backgroundColor: '#F0F4FF',
    padding: 8,
    borderRadius: 6,
  },

  sensorText: {
    fontSize: 12,
    color: '#333',
    marginRight: 12,
    fontWeight: '500',
  },

  notificationFooter: { 
    flexDirection: "row", 
    alignItems: "center",
  },

  notificationLocation: { 
    marginLeft: 4, 
    fontSize: 12, 
    color: "#888", 
    flex: 1,
  },

  rightSection: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 60,
  },

  notificationTime: { 
    fontSize: 12, 
    color: "#999",
    marginBottom: 4,
  },

  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: "#007BFF",
  },

  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },

  resolveButton: {
    padding: 8,
    marginRight: 4,
  },

  deleteButton: {
    padding: 8,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  menuContainer: {
    position: 'absolute',
    right: 16,
    top: 60,
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
  },
});