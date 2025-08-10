import React, { useState, useEffect, useCallback } from "react";
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
import { getAuthHeaders, AnomalyService, API_ENDPOINTS } from '../utils/config/api';
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
    
    // Listen for new notifications
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
      const stats = await AnomalyService.getStats(token, 30); // Last 30 days
      
      if (stats.success) {
        setAnomalyStats(stats.data);
      }
    } catch (error) {
      console.error('Error loading anomaly stats:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      
      // Load anomalies from the real API
      const response = await AnomalyService.getHistory(token, {
        limit: 100,
        sort: '-timestamp'
      });
      
      if (response.success && response.data.anomalies) {
        const formattedNotifications = response.data.anomalies.map(anomaly => ({
          id: anomaly._id,
          title: getAnomalyTitle(anomaly.type),
          message: anomaly.description || `${anomaly.type} detected on ${anomaly.device_name || 'Unknown Device'}`,
          location: anomaly.device_name || "Unknown Device",
          type: getSeverityType(anomaly.severity),
          time: formatTime(anomaly.timestamp),
          date: formatDate(anomaly.timestamp),
          isRead: anomaly.status === 'resolved',
          severity: anomaly.severity,
          confidence_score: anomaly.confidence_score,
          status: anomaly.status,
          device_id: anomaly.device_id,
          anomaly_data: anomaly.data,
          resolved_at: anomaly.resolved_at,
          resolved_by: anomaly.resolved_by,
          resolution_notes: anomaly.resolution_notes,
          timestamp: anomaly.timestamp,
          isPushNotification: false // Mark as server notification
        }));
        
        // Merge with local push notifications
        const localNotifications = await getLocalNotifications();
        const allNotifications = [...formattedNotifications, ...localNotifications]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setNotifications(allNotifications);
      } else {
        // Load local notifications only
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
      
      // Load local notifications as fallback
      try {
        const localNotifications = await getLocalNotifications();
        setNotifications(localNotifications);
      } catch (localError) {
        console.error('Error loading local notifications:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityType = (severity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'critical';
      case 'medium':
        return 'warning';
      case 'low':
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
          type: getSeverityType(notif.data?.severity || 'medium'),
          severity: notif.data?.severity || 'medium',
          time: formatTime(notif.timestamp),
          date: formatDate(notif.timestamp),
          location: notif.data?.device_name || 'Push Notification',
          isRead: notif.read || false
        }));
      }
    } catch (error) {
      console.error('Error loading local notifications:', error);
    }
    return [];
  };

  const getAnomalyTitle = (type) => {
    const titleMap = {
      'temperature_high': 'WiFi Connection Lost',
      'temperature_low': 'Battery Low',
      'humidity_high': 'Backup Completed',
      'humidity_low': 'Data Error',
      'sensor_malfunction': 'Sensor Malfunction',
      'data_anomaly': 'Data Error "IBS-TH3"',
      'pattern_deviation': 'Pattern Deviation',
      'connection_lost': 'WiFi Connection Lost',
      'battery_low': 'Battery Low',
      'test': 'Test Notification'
    };
    
    return titleMap[type] || 'WiFi Connection Lost';
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
        // Mark local push notification as read
        await markLocalNotificationAsRead(id);
      } else {
        // Resolve server anomaly
        const token = await getAuthToken();
        await AnomalyService.resolveAnomaly(token, id, 'Resolved by user');
      }
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true, status: 'resolved' }
          : notification
      ));
      
      Alert.alert('Success', 'Notification marked as resolved');
    } catch (error) {
      console.error('Error resolving notification:', error);
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
      console.error('Error marking local notification as read:', error);
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
      console.error('Error deleting local notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all local notifications as read
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      if (storedNotifications) {
        const localNotifications = JSON.parse(storedNotifications);
        const updatedLocalNotifications = localNotifications.map(notif => ({ ...notif, read: true }));
        await AsyncStorage.setItem('localNotifications', JSON.stringify(updatedLocalNotifications));
      }
      
      // Update state
      setNotifications(
        notifications.map(notification => ({
          ...notification,
          isRead: true
        }))
      );
      setMenuVisible(false);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
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
              // Clear local notifications
              await AsyncStorage.setItem('localNotifications', JSON.stringify([]));
              setNotifications([]);
              setMenuVisible(false);
            } catch (error) {
              console.error('Error deleting all notifications:', error);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    if (notification.isPushNotification) {
      // Handle push notification tap
      if (notification.data?.anomalyId) {
        router.push({
          pathname: "/sensor-detail",
          params: {
            deviceId: notification.data.deviceId,
            anomalyId: notification.data.anomalyId
          }
        });
      } else {
        // Just mark as read
        handleResolveNotification(notification.id, true);
      }
    } else {
      // Navigate to device details for server notifications
      router.push({
        pathname: "/sensor-detail",
        params: {
          deviceId: notification.device_id,
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
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };
  
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => handleNotificationPress(item)}
      style={[
        styles.notificationContainer,
        { backgroundColor: getBackgroundColor(item.type, item.isRead) },
      ]}
    >
      <View style={styles.notificationIcon}>
        {getIcon(item.title, item.type)}
      </View>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.notificationMessage} numberOfLines={1} ellipsizeMode="tail">
          {item.message || item.body}
        </Text>
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
  
  // Menu Modal Styles
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