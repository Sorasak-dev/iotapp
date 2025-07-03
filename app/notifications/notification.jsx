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

const filters = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "critical", label: "Critical", icon: "warning-outline" },
  { id: "high", label: "High", icon: "alert-outline" },
  { id: "medium", label: "Medium", icon: "alert-circle-outline" },
  { id: "low", label: "Low", icon: "information-circle-outline" },
  { id: "unresolved", label: "Unresolved", icon: "time-outline" },
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [anomalyStats, setAnomalyStats] = useState(null);

  useEffect(() => {
    loadNotifications();
    loadAnomalyStats();
  }, []);

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
          type: anomaly.severity || 'medium',
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
          timestamp: anomaly.timestamp
        }));
        
        setNotifications(formattedNotifications);
      } else {
        // Fallback to empty array if no anomalies
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const getAnomalyTitle = (type) => {
    const titleMap = {
      'temperature_high': 'High Temperature Alert',
      'temperature_low': 'Low Temperature Alert',
      'humidity_high': 'High Humidity Alert',
      'humidity_low': 'Low Humidity Alert',
      'sensor_malfunction': 'Sensor Malfunction',
      'data_anomaly': 'Data Anomaly Detected',
      'pattern_deviation': 'Pattern Deviation',
      'connection_lost': 'Connection Lost',
      'battery_low': 'Battery Low'
    };
    
    return titleMap[type] || 'Anomaly Detected';
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
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
    setRefreshing(false);
  }, []);

  const filteredNotifications = notifications.filter(item => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "unresolved") return item.status !== 'resolved';
    return item.type === selectedFilter || item.severity === selectedFilter;
  });

  const getBackgroundColor = (type, isRead, status) => {
    if (isRead || status === 'resolved') return "#F5F5F5";
    
    switch (type) {
      case "critical":
        return "#FDEDED";
      case "high":
        return "#FFF0E0";
      case "medium":
        return "#FFF8E1";
      case "low":
        return "#E3F2FD";
      default:
        return "#FFFFFF";
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#D32F2F';
      case 'high': return '#F57C00';
      case 'medium': return '#FFA000';
      case 'low': return '#388E3C';
      default: return '#666';
    }
  };

  const getIcon = (title, type, severity) => {
    const color = getSeverityColor(severity);
    
    if (title.includes("Temperature")) {
      return <Ionicons name="thermometer" size={24} color={color} />;
    } else if (title.includes("Humidity")) {
      return <Ionicons name="water" size={24} color={color} />;
    } else if (title.includes("Battery")) {
      return <Ionicons name="battery-half" size={24} color={color} />;
    } else if (title.includes("Connection") || title.includes("WiFi")) {
      return <Ionicons name="wifi" size={24} color={color} />;
    } else if (title.includes("Malfunction")) {
      return <Ionicons name="alert-circle" size={24} color={color} />;
    } else {
      return <Ionicons name="warning" size={24} color={color} />;
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    setMenuVisible(false);
  };
  
  const handleResolveNotification = async (id) => {
    try {
      const token = await getAuthToken();
      await AnomalyService.resolveAnomaly(token, id, 'Resolved by user');
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true, status: 'resolved' }
          : notification
      ));
      
      Alert.alert('Success', 'Anomaly marked as resolved');
    } catch (error) {
      console.error('Error resolving anomaly:', error);
      Alert.alert('Error', 'Failed to resolve anomaly');
    }
  };

  const handleDeleteNotification = (id) => {
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
          onPress: () => {
            setNotifications(notifications.filter(item => item.id !== id));
          },
          style: "destructive"
        }
      ]
    );
  };

  const markAllAsRead = async () => {
    try {
      // In a real implementation, you might want to call an API to mark all as read
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
          onPress: () => {
            setNotifications([]);
            setMenuVisible(false);
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    // Navigate to detailed view or device details
    router.push({
      pathname: "/sensor-detail",
      params: {
        deviceId: notification.device_id,
        anomalyId: notification.id
      }
    });
  };
  
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => handleNotificationPress(item)}
      style={[
        styles.notificationContainer,
        { backgroundColor: getBackgroundColor(item.type, item.isRead, item.status) },
      ]}
    >
      <View style={styles.notificationIcon}>
        {getIcon(item.title, item.type, item.severity)}
      </View>
      <View style={styles.notificationText}>
        <View style={styles.titleRow}>
          <Text style={styles.notificationTitle} numberOfLines={1} ellipsizeMode="tail">
            {item.title}
          </Text>
          {item.status === 'resolved' && (
            <View style={styles.resolvedBadge}>
              <Text style={styles.resolvedBadgeText}>RESOLVED</Text>
            </View>
          )}
        </View>
        <Text style={styles.notificationMessage} numberOfLines={2} ellipsizeMode="tail">
          {item.message}
        </Text>
        <View style={styles.notificationFooter}>
          <Ionicons name="location-outline" size={16} color="gray" />
          <Text style={styles.notificationLocation} numberOfLines={1} ellipsizeMode="tail">
            {item.location}
          </Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
        {item.confidence_score && (
          <Text style={styles.confidenceScore}>
            Confidence: {parseFloat(item.confidence_score).toFixed(2)}
          </Text>
        )}
      </View>
      
      {!item.isRead && item.status !== 'resolved' && <View style={styles.unreadDot} />}
      
      {editMode && (
        <View style={styles.actionButtons}>
          {item.status !== 'resolved' && (
            <TouchableOpacity 
              style={styles.resolveButton}
              onPress={() => handleResolveNotification(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="green" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleDeleteNotification(item.id)}
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
          <Text style={styles.headerTitle}>Anomaly Notifications</Text>
          <TouchableOpacity style={styles.moreOptions} onPress={() => setMenuVisible(true)}>
            <MaterialIcons name="more-vert" size={24} color="black" />
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        {anomalyStats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{anomalyStats.total_anomalies || 0}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, {color: '#D32F2F'}]}>
                {anomalyStats.unresolved_count || 0}
              </Text>
              <Text style={styles.statLabel}>Unresolved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, {color: '#4CAF50'}]}>
                {anomalyStats.resolved_count || 0}
              </Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
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
                color={selectedFilter === filter.id ? "white" : "black"}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter.id && { color: "white" },
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
                onPress={markAllAsRead}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="black" />
                <Text style={styles.menuItemText}>Mark All as Read</Text>
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
    marginVertical: 10, 
  },

  backButton: {
    padding: 8,
  },

  moreOptions: {
    padding: 8,
  },

  headerTitle: { 
    fontSize: 22, 
    fontWeight: "bold",
    flex: 1,
    marginLeft: 8,
  },

  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  statItem: {
    alignItems: 'center',
  },

  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },

  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  filterScroll: {
    flexGrow: 0,
  },
  
  filterContainer: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#DADADA",
    marginBottom: 12,
  },

  filterButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 10,
    marginRight: 10, 
    borderRadius: 20, 
    backgroundColor: "#E0E0E0",
  },

  selectedFilter: { backgroundColor: "#007BFF" },
  filterText: { marginLeft: 4, fontSize: 14 },
  
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
  
  notificationContainer: { 
    flexDirection: "row", 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 10, 
    alignItems: "flex-start",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  
  notificationIcon: { 
    marginRight: 10,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 2,
  },

  notificationText: { flex: 1 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  notificationTitle: { 
    fontWeight: "bold", 
    fontSize: 16,
    flex: 1,
  },

  resolvedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },

  resolvedBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  notificationMessage: { 
    fontSize: 14, 
    color: "gray",
    marginBottom: 6,
  },

  notificationFooter: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 4,
  },

  notificationLocation: { 
    marginLeft: 4, 
    fontSize: 12, 
    color: "gray", 
    flex: 1,
  },

  notificationTime: { 
    marginLeft: "auto", 
    fontSize: 12, 
    color: "gray",
  },

  confidenceScore: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },

  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: "#007BFF",
    marginTop: 8,
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