import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const filters = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "Critical", label: "Critical", icon: "warning-outline" },
  { id: "Warning", label: "Warning", icon: "alert-outline" },
  { id: "Info", label: "Info", icon: "information-circle-outline" },
];

const notificationsData = [
  {
    id: "1",
    title: "WiFi Connection Lost",
    message: 'Unable to connect to "IBS-TH3"',
    location: "Factory 1 hibiscus flower plot",
    type: "Critical",
    time: "2 hours ago",
    isRead: false,
    date: "Today",
  },
  {
    id: "2",
    title: "Battery Low",
    message: '20% battery remaining "IBS-TH3"',
    location: "Factory 1 hibiscus flower plot",
    type: "Warning",
    time: "3 hours ago",
    isRead: false,
    date: "Today",
  },
  {
    id: "3",
    title: "Backup Completed",
    message: 'Your files have been successfully backed up "IBS-TH3"',
    location: "Factory 1 hibiscus flower plot",
    type: "Info",
    time: "12 jan 2024",
    isRead: true,
    date: "Yesterday",
  },
  {
    id: "4",
    title: 'Data Error "IBS-TH3"',
    message: "There is a problem with the data",
    location: "Factory 1 hibiscus flower plot",
    type: "Info",
    time: "12 jan 2024",
    isRead: true,
    date: "Yesterday",
  },
  {
    id: "5",
    title: "WiFi Connection Lost",
    message: 'Unable to connect to "IBS-TH3"',
    location: "Factory 1 hibiscus flower plot",
    type: "Critical",
    time: "12 jan 2024",
    isRead: true,
    date: "Yesterday",
  },
];

export default function NotificationScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [notifications, setNotifications] = useState(notificationsData);
  const [editMode, setEditMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const filteredNotifications =
    selectedFilter === "all"
      ? notifications
      : notifications.filter((item) => item.type === selectedFilter);

  const getBackgroundColor = (type, isRead) => {
    if (isRead) return "#FFFFFF";
    switch (type) {
      case "Critical":
        return "#FDEDED";
      case "Warning":
        return "#FFF8E1";
      case "Info":
        return "#E3F2FD";
      default:
        return "#FFFFFF";
    }
  };

  const getIcon = (title, type) => {
    if (type === "Info") {
      if (title.includes("Backup Completed")) {
        return (
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={24} color="green" />
          </View>
        );
      } else if (title.includes("Data Error")) {
        return (
          <View style={styles.infoIconContainer}>
            <Ionicons name="alert-circle" size={24} color="blue" />
          </View>
        );
      }
    }
  
    switch (type) {
      case "Critical":
        return <Ionicons name="wifi" size={24} color="red" />;
      case "Warning":
        return <Ionicons name="battery-half" size={24} color="orange" />;
      default:
        return null;
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    setMenuVisible(false);
  };
  
  const handleDeleteNotification = (id) => {
    setNotifications(notifications.filter(item => item.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(
      notifications.map(notification => ({
        ...notification,
        isRead: true
      }))
    );
    setMenuVisible(false);
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
  
  const renderNotificationItem = ({ item }) => (
    <View
      style={[
        styles.notificationContainer,
        { backgroundColor: getBackgroundColor(item.type, item.isRead) },
      ]}
    >
      <View style={styles.notificationIcon}>{getIcon(item.title, item.type)}</View>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
        <Text style={styles.notificationMessage} numberOfLines={2} ellipsizeMode="tail">{item.message}</Text>
        <View style={styles.notificationFooter}>
          <Ionicons name="location-outline" size={16} color="gray" />
          <Text style={styles.notificationLocation} numberOfLines={1} ellipsizeMode="tail">{item.location}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
      {editMode && (
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteNotification(item.id)}
        >
          <Ionicons name="trash-outline" size={24} color="red" />
        </TouchableOpacity>
      )}
    </View>
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
            <MaterialIcons name="more-vert" size={24} color="black" />
          </TouchableOpacity>
        </View>

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

        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />

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
    
    notificationContainer: { 
      flexDirection: "row", 
      padding: 12, 
      borderRadius: 8, 
      marginBottom: 10, 
      alignItems: "center" 
    },
    
    notificationIcon: { 
      marginRight: 10,
      width: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },

    successIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#E0FFE0",
      justifyContent: "center",
      alignItems: "center",
    },
    infoIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#E3F2FD",
      justifyContent: "center",
      alignItems: "center",
    },
    notificationText: { flex: 1 },
    notificationTitle: { fontWeight: "bold", fontSize: 16 },
    notificationMessage: { fontSize: 14, color: "gray" },
    notificationFooter: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    notificationLocation: { marginLeft: 4, fontSize: 12, color: "gray", flex: 1 },
    notificationTime: { marginLeft: "auto", fontSize: 12, color: "gray" },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#007BFF" },
    deleteButton: {
      padding: 8,
      marginLeft: 4,
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