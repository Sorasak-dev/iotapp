import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Support from "../components/Support";

const { width, height } = Dimensions.get('window');

const DeviceMonitorScreen = () => {
  const router = useRouter();

  // Calculate responsive styling
  const isSmallScreen = width < 375;
  const isMediumScreen = width >= 375 && width < 414;
  
  const getResponsiveStyles = () => ({
    horizontalPadding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    fontSize: {
      title: isSmallScreen ? 18 : 20,
      sectionTitle: isSmallScreen ? 16 : 18,
      paragraph: isSmallScreen ? 14 : 15,
      listItem: isSmallScreen ? 14 : 15,
    }
  });

  const responsive = getResponsiveStyles();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/help/help-center');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: responsive.horizontalPadding }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: responsive.fontSize.title }]}>
          Device Monitor
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingHorizontal: responsive.horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={[styles.paragraph, { fontSize: responsive.fontSize.paragraph }]}>
            This feature allows you to monitor the real-time status of all connected IoT devices within the system, ensuring that every device operates efficiently and minimizing the risk of undetected malfunctions.
          </Text>
        </View>

        {/* Check devices section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: responsive.fontSize.sectionTitle }]}>
            Check devices
          </Text>
          <View style={styles.blueBorder}>
            <Text style={[styles.paragraph, { fontSize: responsive.fontSize.paragraph, marginBottom: 12 }]}>
              The system clearly displays the status of each device:
            </Text>
            
            <View style={styles.statusList}>
              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>✅</Text>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { fontSize: responsive.fontSize.listItem }]}>Online:</Text>
                  <Text style={[styles.statusDescription, { fontSize: responsive.fontSize.listItem }]}>
                    The device is functioning properly and transmitting data as expected.
                  </Text>
                </View>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>🔴</Text>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { fontSize: responsive.fontSize.listItem }]}>Offline:</Text>
                  <Text style={[styles.statusDescription, { fontSize: responsive.fontSize.listItem }]}>
                    The device is disconnected—this may be due to power failure, signal loss, or internal issues.
                  </Text>
                </View>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>⚠️</Text>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { fontSize: responsive.fontSize.listItem }]}>Error:</Text>
                  <Text style={[styles.statusDescription, { fontSize: responsive.fontSize.listItem }]}>
                    The device has encountered an issue such as abnormal sensor readings or failure to collect data.
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.paragraph, { fontSize: responsive.fontSize.paragraph, marginTop: 12 }]}>
              Users can view the overall system status in a single dashboard without having to check each device individually—saving time and improving system management.
            </Text>
          </View>
        </View>

        {/* Last Connection section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: responsive.fontSize.sectionTitle }]}>
            Last Connection Timestamp
          </Text>
          <View style={styles.blueBorder}>
            <Text style={[styles.paragraph, { fontSize: responsive.fontSize.paragraph, marginBottom: 12 }]}>
              If a device has not transmitted data for a certain period, the system will display the date and time of its last connection to help users identify potential issues.
            </Text>
            
            <View style={styles.exampleContainer}>
              <Text style={[styles.exampleText, { fontSize: responsive.fontSize.paragraph }]}>
                For example: "This device has not connected since yesterday at 1:45 PM."
              </Text>
            </View>
            
            <Text style={[styles.paragraph, { fontSize: responsive.fontSize.paragraph, marginTop: 12 }]}>
              This helps determine when the issue started and whether it is ongoing, assisting in faster troubleshooting and resolution.
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
    fontWeight: "600",
    marginLeft: 16,
    color: "#000",
  },
  content: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  paragraph: {
    color: "#666",
    lineHeight: 22,
  },
  blueBorder: {
    borderWidth: 2,
    borderColor: "#E3F3FF",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#FAFCFF",
  },
  statusList: {
    marginVertical: 8,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  statusDescription: {
    color: "#666",
    lineHeight: 20,
  },
  exampleContainer: {
    backgroundColor: "#F0F8FF",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  exampleText: {
    color: "#1E40AF",
    fontStyle: "italic",
    lineHeight: 20,
  },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  footerText: {
    color: "#8FBAF3",
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  contactContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    color: "#8FBAF3",
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default DeviceMonitorScreen;