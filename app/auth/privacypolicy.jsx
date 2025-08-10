import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import BackButton from "../components/BackButton";

export default function PrivacyPolicy() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Privacy Policy</Text>
        
        <Text style={styles.introduction}>
          The IoT Smart Farming Research Project is committed to protecting your privacy and personal data.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Questionnaire responses: age, gender, experience with technology
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              System usage data: user behavior, click patterns, response to alerts
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Technical data: device type, sensor connectivity status
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Purpose of Data Use</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              To analyze user behavior and usability challenges
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              To improve system performance, sensor connectivity, and UX/UI design
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              To publish research findings in academic formats (with no identifiable user information)
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Data Storage and Security</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              All collected data is stored in a secure, encrypted system to ensure confidentiality and integrity.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Your Rights</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              You may request access to, correction of, or deletion of your personal data
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              You may withdraw your consent to data collection at any time without consequences
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Disclosure</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Your data will not be sold or shared with any third parties
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Research results will be presented in aggregate form, without any personal identifiers
            </Text>
          </View>
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