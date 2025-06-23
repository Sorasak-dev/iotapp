import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions
} from "react-native";
import { useRouter } from "expo-router";
import Support from "../components/Support";

const { width, height } = Dimensions.get('window');

const ManageZonesScreen = () => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
       router.push('/help/help-center');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage your zones</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introSection}>
          <Text style={styles.introText}>
            "Your Zone" is a system for managing cultivation areas or locations equipped with IoT devices. It is designed to help users efficiently monitor and control sensor data in each designated area.
          </Text>
          <Text style={styles.introText}>
            A well-structured zoning system enhances data analysis and enables precise and targeted alert management.
          </Text>
        </View>

        <View style={styles.zoneListSection}>
          <Text style={styles.sectionTitle}>Zone List</Text>
          <View style={styles.zoneListContainer}>
            <Text style={styles.zoneListText}>
              Users can view a list of all zones that have been created. Each zone displays basic details such as:
            </Text>
            <Text style={styles.listItem}>• Zone name</Text>
            <Text style={styles.listItem}>• Number of connected devices within the zone</Text>
            <Text style={styles.listItem}>• Sensor connection status</Text>
          </View>
        </View>

        <View style={styles.zoneListSection}>
          <Text style={styles.sectionTitle}>Edit Zone</Text>
          <View style={styles.zoneListContainer}>
            <Text style={styles.zoneListText}>
              Users can customize zone names to reflect their actual usage, such as "Front Yard Vegetable Plot" or "Greenhouse A". They can also select the type of area—such as cultivation plot, greenhouse, or laboratory—to ensure clear data management within the system. This helps make it easier to monitor sensor status and accurately analyze data for each specific area.
            </Text>
          </View>
        </View>

        <View style={styles.zoneListSection}>
          <Text style={styles.sectionTitle}>Sensor Monitoring in the Zone</Text>
          <View style={styles.zoneListContainer}>
            <Text style={styles.zoneListText}>
              Users can access real-time data from each sensor within the zone, including:
            </Text>
            <Text style={styles.listItem}>• Temperature (°C)</Text>
            <Text style={styles.listItem}>• Relative Humidity (%)</Text>
            <Text style={styles.listItem}>• VPD (Vapor Pressure Deficit)</Text>
            <Text style={styles.listItem}>• Device power status</Text>
            <Text style={styles.zoneListText}>
              This data is presented in graphs and tables for easier trend analysis and planning.
            </Text>
          </View>
        </View>

        <View style={styles.zoneListSection}>
          <Text style={styles.sectionTitle}>Add New Zone</Text>
          <View style={styles.zoneListContainer}>
            <Text style={styles.zoneListText}>
              Users can create a new zone by providing the following information:
            </Text>
            <Text style={styles.listItem}>• Zone name</Text>
            <Text style={styles.listItem}>• Type of crop or purpose of the area</Text>
            <Text style={styles.listItem}>• List of devices to be connected</Text>
            <Text style={styles.listItem}>• Specific alert conditions for that zone (e.g., alert when temperature exceeds 35°C)</Text>
          </View>
        </View>

        <View style={styles.zoneListSection}>
          <Text style={styles.sectionTitle}>Zone List</Text>
          <View style={styles.zoneListContainer}>
            <Text style={styles.zoneListText}>
              Users can remove unused zones from the system to keep zone management organized. Before the deletion is finalized, the system will display a confirmation prompt to prevent accidental deletions.
            </Text>
            <Text style={styles.zoneListText}>
              Deleting a zone is useful when users want to reduce clutter by removing unnecessary areas from the list. This allows them to focus more easily on active zones, improving the efficiency of monitoring and data tracking within the system.
            </Text>
          </View>
        </View>

        {/* Support Footer */}
        <Support />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: "#000",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 16,
    color: "#000",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  introSection: {
    marginBottom: 24,
  },
  introText: {
    fontSize: 15,
    color: "#000000",
    lineHeight: 22,
  },
  zoneListSection: {
    marginBottom: 24,
  },
  zoneListContainer: {
    borderWidth: 1,
    borderColor: "#E3F3FF",
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  paragraph: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  zoneListText: {
    fontSize: 15,
    color: "#000000",
    lineHeight: 22,
  },
  listItem: {
    fontSize: 15,
    color: "#9B9B9B",
    lineHeight: 22,
    marginLeft: 10,
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: "#8FBAF3",
    lineHeight: 20,
    textAlign: 'center',
  },
  contactContainer: {
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: "#8FBAF3",
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default ManageZonesScreen;