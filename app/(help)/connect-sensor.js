import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";

// เปลี่ยนชื่อ Component ให้ตรงกับหน้าที่สร้าง
const ConnectSensorScreen = () => { 
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/help-center'); // หรือ path ที่เหมาะสม
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        {/* เปลี่ยน Title ให้ตรงกับชื่อหน้า */}
        <Text style={styles.headerTitle}>How to connect your sensor</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 1: Unbox Your Sensor</Text>
          <Text style={styles.paragraph}>
            Carefully unbox the sensor and ensure all components are present.
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 2: Power On</Text>
          <Text style={styles.paragraph}>
            Insert the battery or connect the power adapter to turn on the device.
          </Text>
        </View>
         {/* เพิ่มเนื้อหาอื่นๆ ตามต้องการ */}
      </ScrollView>
    </SafeAreaView>
  );
};

// สามารถใช้ Styles เดิมจากหน้า About Us หรือปรับแก้ได้ตามต้องการ
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
});

export default ConnectSensorScreen;