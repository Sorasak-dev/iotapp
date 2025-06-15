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

const StatisticsScreen = () => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      console.log("กำลังนำทางไปยัง /help-center");
      router.push('/features/help');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Clear historical data analysis enables users to thoroughly understand the overall environmental conditions and changes over specific periods.
          </Text>
          <Text style={styles.paragraph}>
            This information supports effective decision-making in managing cultivation areas such as adjusting irrigation, controlling temperature, or planning the use of various resources appropriately.
          </Text>
          <Text style={styles.paragraph}>
            It helps reduce risks and enhances productivity to meet targeted goals more efficiently.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily / Weekly / Monthly View</Text>
          <View style={styles.blueBorder}>
            <Text style={styles.paragraph}>
              You can flexibly view environmental data on a daily, weekly, or monthly basis according to your needs. This feature allows you to examine detailed insights for each time period and conveniently compare trends across different time frames. This helps you gain a clear overview of changes and make better-informed decisions.
            </Text>
            <View style={styles.imageContainer}>
              <Image
                source={require('../assets/s1.png')}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compare data between zones or across time periods</Text>
          <View style={styles.blueBorder}>
            <Text style={styles.paragraph}>
              If the cultivation area is divided into multiple zones—such as Zone A, B, and C—users can compare the data collected from each zone.
            </Text>
            <Text style={styles.listItem}>• Zone A may have a stable temperature, while Zone B shows an unusual drop in humidity.</Text>
            <Text style={styles.listItem}>• Users can also compare temperature data from this week with last week's to observe changes over time.</Text>
            
            <Text style={styles.paragraph}>
              This comparison helps users identify which areas need adjustments—such as improving irrigation or ventilation systems—and supports better decision-making for optimizing cultivation strategies in each specific zone.
            </Text>
            <View style={styles.imageContainer}>
              <Image
                source={require('../assets/s2.png')}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
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

export default StatisticsScreen;