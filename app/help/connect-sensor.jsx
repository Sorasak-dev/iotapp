import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import Support from "../components/Support";

const { width, height } = Dimensions.get('window');

const ConnectSensorScreen = () => {
  const router = useRouter();
  
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
          How to Connect Your Sensor
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingHorizontal: responsive.horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1 */}
        <View style={styles.section}>
          <Text style={[styles.stepTitle, { fontSize: responsive.fontSize.stepTitle }]}>
            1. Select "+" or select "Add device"
          </Text>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/images/1select.png")}
              style={styles.stepImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Step 2 */}
        <View style={styles.section}>
          <Text style={[styles.stepTitle, { fontSize: responsive.fontSize.stepTitle }]}>
            2. Select device that you want to connect
          </Text>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/images/2_select.png")}
              style={styles.stepImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Step 3 */}
        <View style={styles.section}>
          <Text style={[styles.stepTitle, { fontSize: responsive.fontSize.stepTitle }]}>
            3. Add other device
          </Text>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/images/select3.png")}
              style={[styles.stepImage, { height: 120 }]}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Step 4 */}
        <View style={styles.section}>
          <Text style={[styles.stepTitle, { fontSize: responsive.fontSize.stepTitle }]}>
            4. Complete the connection
          </Text>
          <View style={styles.imageContainer}>
            <Image
              source={require("../assets/images/3select.png")}
              style={styles.stepImage}
              resizeMode="contain"
            />
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
  stepTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  imageContainer: {
    borderWidth: 2,
    borderColor: "#E3F3FF",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#FAFCFF",
    alignItems: 'center',
  },
  stepImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
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

export default ConnectSensorScreen;