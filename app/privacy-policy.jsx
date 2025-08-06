// app/privacy-policy.jsx
import React from 'react';
import { ScrollView, Text, StyleSheet, SafeAreaView, View, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';

const Header = ({ title, onBackPress }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
  </View>
);

const PrivacyPolicyScreen = () => {
  const router = useRouter();
  const content = `
**มีผลบังคับใช้: 1 สิงหาคม 2568**

ขอขอบคุณที่เลือกใช้บริการแอปพลิเคชันของเรา นโยบายความเป็นส่วนตัวฉบับนี้จัดทำขึ้นเพื่อแจ้งให้ท่านทราบถึงวิธีการที่เราเก็บรวบรวม, ใช้, และเปิดเผยข้อมูลของท่าน

**1. ข้อมูลที่เรารวบรวม**
เราอาจรวบรวมข้อมูลประเภทต่างๆ ดังนี้:
* ข้อมูลส่วนบุคคลที่ท่านมอบให้โดยตรง เช่น ชื่อ, อีเมล, รหัสผ่าน
* ข้อมูลจากอุปกรณ์และเซ็นเซอร์ที่เชื่อมต่อ เช่น อุณหภูมิ, ความชื้น
* ข้อมูลการใช้งานแอปพลิเคชัน เช่น ฟีเจอร์ที่ท่านใช้งาน, รายงานข้อผิดพลาด

**2. เราใช้ข้อมูลของท่านอย่างไร**
เราใช้ข้อมูลที่รวบรวมมาเพื่อ:
* ให้บริการและบำรุงรักษาแอปพลิเคชัน
* จัดการบัญชีและยืนยันตัวตนของท่าน
* ส่งการแจ้งเตือนที่สำคัญเกี่ยวกับการทำงานของอุปกรณ์
* วิเคราะห์ข้อมูลเพื่อตรวจจับความผิดปกติและปรับปรุงบริการ

**3. การเปิดเผยข้อมูล**
เราจะไม่เปิดเผยข้อมูลของท่านให้แก่บุคคลที่สามโดยไม่ได้รับความยินยอม ยกเว้นในกรณีที่จำเป็นตามข้อบังคับของกฎหมาย

**4. การรักษาความปลอดภัย**
เราใช้มาตรการที่เหมาะสมเพื่อปกป้องข้อมูลของท่าน แต่ไม่มีวิธีการใดที่ปลอดภัย 100%

**5. ติดต่อเรา**
หากมีข้อสงสัยเกี่ยวกับนโยบายนี้ กรุณาติดต่อเราที่: [อีเมลติดต่อ]
  `;

  const renderContent = (text) => {
    return text.split('\n').map((line, index) => {
      if (line.trim().startsWith('**')) {
        return <Text key={index} style={styles.subHeader}>{line.replace(/\*\*/g, '').trim()}</Text>;
      }
      if (line.trim().startsWith('*')) {
        return <Text key={index} style={styles.bulletPoint}>•  {line.replace('*', '').trim()}</Text>;
      }
      return <Text key={index} style={styles.paragraph}>{line.trim()}</Text>;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="นโยบายความเป็นส่วนตัว" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
            {renderContent(content.trim())}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
  },
  subHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    marginBottom: 8,
    marginLeft: 10,
  },
});

export default PrivacyPolicyScreen;
