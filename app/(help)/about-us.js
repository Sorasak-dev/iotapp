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

const AboutUsScreen = () => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // หากไม่สามารถย้อนกลับได้ ให้ไปที่หน้าหลักหรือหน้า settings
      router.push('/tabs/settings');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.paragraph}>
            Our mission is to provide you with the most accurate and reliable
            environmental data through our state-of-the-art sensor technology.
            We believe that by making data accessible and easy to understand, we
            can empower individuals and communities to make informed decisions
            about their environment.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who We Are</Text>
          <Text style={styles.paragraph}>
            We are a team of passionate engineers, developers, and designers
            dedicated to building innovative solutions for a smarter and more
        connected world. Our journey began with a simple idea: to make
            environmental monitoring effortless and available to everyone.
          </Text>
        </View>

         <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Technology</Text>
          <Text style={styles.paragraph}>
            The sensor system is built on years of research and development. It
            combines high-precision hardware with intelligent software to
            deliver real-time insights. We are committed to continuous
            improvement and innovation to ensure our products remain at the
            forefront of the industry.
          </Text>
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
});

export default AboutUsScreen;