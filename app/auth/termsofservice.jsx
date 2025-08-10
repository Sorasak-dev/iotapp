import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import BackButton from "../components/BackButton";

export default function TermsOfService() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Terms of Service</Text>
        
        <Text style={styles.introduction}>
          Please read these Terms of Service carefully before using the system developed under the IoT Smart Farming Research Project.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionContent}>
            By accessing or using this system, you agree to be bound by these Terms. If you do not agree with any part of the terms, you should discontinue using the system immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Purpose of the System</Text>
          <Text style={styles.sectionContent}>
            This system is part of an academic research project aiming to investigate real-world usage of IoT-based smart farming technologies, including user behavior, challenges encountered, and improvements to UX/UI design tailored for rural users.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Conditions of Use</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Users must not use the system for any illegal or harmful purposes.
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Copying, modifying, or distributing the software without written permission is strictly prohibited.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Limitation of Liability</Text>
          <Text style={styles.sectionContent}>
            The research team shall not be held liable for any damages arising from the use of the system, including data inaccuracies, system malfunction, or loss of information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Suspension or Termination of Access</Text>
          <Text style={styles.sectionContent}>
            The research team reserves the right to suspend or terminate user access in the event of misuse or violation of these terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Amendments</Text>
          <Text style={styles.sectionContent}>
            These Terms of Service may be updated at any time without prior notice. Users are encouraged to review the terms regularly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  scrollView: {
    flex: 1,
    marginHorizontal: 32,
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#374151',
  },
  introduction: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#4B5563',
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
});