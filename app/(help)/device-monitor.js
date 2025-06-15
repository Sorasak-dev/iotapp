import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";

const DeviceMonitorScreen = () => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      console.log("กำลังนำทางไปยัง /features/help");
      router.push('/features/help');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Device Monitor</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            This feature allows you to monitor the real-time status of all connected IoT devices within the system, ensuring that every device operates efficiently and minimizing the risk of undetected malfunctions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Check devices</Text>
          <View style={styles.blueBorder}>
            <Text style={styles.paragraph}>
              The system clearly displays the status of each device:
            </Text>
            <Text style={styles.listItem}>• ✅ Online: The device is functioning properly and transmitting data as expected.</Text>
            <Text style={styles.listItem}>• 🔴 Offline: The device is disconnected—this may be due to power failure, signal loss, or internal issues.</Text>
            <Text style={styles.listItem}>• ⚠️ Error: The device has encountered an issue such as abnormal sensor readings or failure to collect data.</Text>
            
            <Text style={styles.paragraph}>
              Users can view the overall system status in a single dashboard without having to check each device individually—saving time and improving system management.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Connection Timestamp</Text>
          <View style={styles.blueBorder}>
            <Text style={styles.paragraph}>
              If a device has not transmitted data for a certain period, the system will display the date and time of its last connection to help users identify potential issues.
            </Text>
            <Text style={styles.paragraph}>
              For example: "This device has not connected since yesterday at 1:45 PM."
            </Text>
            <Text style={styles.paragraph}>
              This helps determine when the issue started and whether it is ongoing, assisting in faster troubleshooting and resolution.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            พบปัญหาในการใช้งาน กรุณาติดต่อฝ่ายสนับสนุนของเราได้ที่
          </Text>
          <View style={styles.contactContainer}>
            <Text style={styles.contactText}>
              Email: support@smartiot.com
            </Text>
            <Text style={styles.contactText}>
              Tell: 000-000-0000
            </Text>
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
  },
  section: {
    marginBottom: 24,
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
  listItem: {
    fontSize: 15,
    color: "#9B9B9B",
    lineHeight: 28, // Ensures each bullet point is on a new line
    marginLeft: 10,
  },
  blueBorder: {
    borderWidth: 2,
    borderColor: "#E3F3FF",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  imageContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  image: {
    width: '50%',
    height: 150, // Adjust height as needed
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

export default DeviceMonitorScreen;