// app/privacy.jsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Svg, Path } from 'react-native-svg';

// --- Icons (Minimal Style) ---
const DocumentTextIcon = () => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></Path>
        <Path d="M14 2v6h6"></Path>
        <Path d="M16 13H8"></Path><Path d="M16 17H8"></Path><Path d="M10 9H8"></Path>
    </Svg>
);

const ClipboardDocumentListIcon = () => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></Path>
        <Path d="M16 2a2 2 0 0 0-4 0h-4a2 2 0 0 0 0 4h12a2 2 0 0 0 0-4h-4a2 2 0 0 0-4 0z"></Path>
        <Path d="M9 12h6"></Path><Path d="M9 16h6"></Path>
    </Svg>
);

const ChevronRightIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 18l6-6-6-6"></Path>
    </Svg>
);

// --- Reusable Components ---
const Header = ({ title, onBackPress }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const SettingsListItem = ({ icon, title, description, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.listItem}>
    <View style={styles.iconContainer}>{icon}</View>
    <View style={styles.textContainer}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemDescription}>{description}</Text>
    </View>
    <ChevronRightIcon />
  </TouchableOpacity>
);

// --- Main Screen ---
const PrivacySecurityScreen = () => {
  const router = useRouter();

  const legalItems = [
    {
      icon: <DocumentTextIcon />,
      title: 'นโยบายความเป็นส่วนตัว',
      description: 'ข้อมูลที่เรารวบรวมและวิธีการใช้งาน',
      onPress: () => router.push('/privacy-policy')
    },
    {
      icon: <ClipboardDocumentListIcon />,
      title: 'ข้อกำหนดการให้บริการ',
      description: 'กฎและข้อบังคับในการใช้บริการของเรา',
      onPress: () => router.push('/terms-of-service')
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Privacy & Security" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.section}>
            <Text style={styles.sectionHeader}>กฎหมายและนโยบาย</Text>
            <View style={styles.listContainer}>
              {legalItems.map((item, itemIndex) => (
                <View key={itemIndex}>
                  <SettingsListItem {...item} />
                  {itemIndex < legalItems.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles (Clean & Minimal) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    paddingVertical: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6D6D72',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 17,
    color: '#000000',
  },
  itemDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 64,
  },
});

export default PrivacySecurityScreen;
