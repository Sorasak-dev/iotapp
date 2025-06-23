import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Platform,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Svg, Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import i18n from '../../locales/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const SettingsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [language, setLanguage] = useState(i18n.language);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  useEffect(() => {
    const loadStoredLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem("userLanguage");
        if (storedLanguage) {
          i18n.changeLanguage(storedLanguage);
          setLanguage(storedLanguage);
        }
      } catch (error) {
        console.error("Error loading language", error);
      }
    };

    loadStoredLanguage();
  }, []);

  const changeLanguage = async (lng) => {
    try {
      await AsyncStorage.setItem("userLanguage", lng);
      i18n.changeLanguage(lng);
      setLanguage(lng);
    } catch (error) {
      console.error("Error saving language", error);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('email');
      Toast.show({
        type: 'success',
        text1: 'Logout Successful',
        text2: 'You have been logged out.',
      });
      router.replace('/auth/sign-in');
    } catch (error) {
      console.error('Error during logout:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Something went wrong while logging out.',
      });
    }
  };

  const LanguageToggle = () => (
    <TouchableOpacity
      style={[
        styles.languageToggle,
        language === "th" ? styles.thToggle : styles.enToggle,
      ]}
      onPress={() => changeLanguage(language === "th" ? "en" : "th")}
    >
      <View style={styles.languageToggleTrack}>
        <View
          style={[
            styles.languageToggleThumb,
            language === "th" ? styles.thumbLeft : styles.thumbRight,
          ]}
        >
          <Text style={styles.toggleText}>
            {language === "th" ? "TH" : "EN"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ArrowIcon = () => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke="#CCCCCC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const settingsItems = [
    {
      section: t('Account Security'),
      items: [
        {
          icon: (
            <Svg width="15" height="13" viewBox="0 0 15 13" fill="none">
              <Path
                d="M0.563232 12.4375C1.61252 10.6873 3.9122 9.48948 7.50003 9.48948C11.0879 9.48948 13.3876 10.6873 14.4368 12.4375M10.35 3.4125C10.35 4.98651 9.07405 6.2625 7.50003 6.2625C5.92602 6.2625 4.65003 4.98651 4.65003 3.4125C4.65003 1.83849 5.92602 0.5625 7.50003 0.5625C9.07405 0.5625 10.35 1.83849 10.35 3.4125Z"
                stroke="#609CFF"
                strokeLinecap="round"
              />
            </Svg>
          ),
          title: t('Account Edit'),
          hasArrow: true,
          onPress: () => router.push("/features/edit_profile"),
        },
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M9.50005 1.8999C7.36508 3.71504 6.02685 3.7999 3.80005 3.7999V11.1054C3.80005 14.0206 5.82862 14.7813 9.50005 17.0999C13.1715 14.7813 15.2001 14.0206 15.2001 11.1054C15.2001 8.19017 15.2001 3.7999 15.2001 3.7999C12.9733 3.7999 11.635 3.71504 9.50005 1.8999Z"
                stroke="#39BF39"
                strokeLinejoin="round"
              />
            </Svg>
          ),
          title: t('Privacy & Security'),
          hasArrow: true,
          onPress: () => router.push("privacy"),
        },
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M5.22505 6.96657V6.24276C5.22505 3.83695 7.13183 1.8999 9.50005 1.8999C11.8683 1.8999 13.775 3.83695 13.775 6.24276V6.96657M5.22505 6.96657C4.4413 6.96657 3.80005 7.618 3.80005 8.41419V15.6523C3.80005 16.4485 4.4413 17.0999 5.22505 17.0999H13.775C14.5588 17.0999 15.2001 16.4485 15.2001 15.6523V8.41419C15.2001 7.618 14.5588 6.96657 13.775 6.96657M5.22505 6.96657H13.775"
                stroke="#006EDC"
                strokeLinecap="round"
              />
            </Svg>
          ),
          title: t('Password'),
          hasArrow: true,
          onPress: () => router.push("/auth/change_password"),
        },
      ],
    },
    {
      section: t('Preferences'),
      items: [
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M7.38897 15.9053C7.94921 16.3529 8.68904 16.625 9.50008 16.625C10.3111 16.625 11.0509 16.3529 11.6112 15.9053M3.56862 13.6022C3.23485 13.6022 3.04843 13.0779 3.25033 12.7866C3.71882 12.1106 4.17102 11.1191 4.17102 9.92512L4.19034 8.19506C4.19034 4.98073 6.56759 2.375 9.50008 2.375C12.4758 2.375 14.888 5.01911 14.888 8.28079L14.8687 9.92512C14.8687 11.1273 15.3053 12.1242 15.7548 12.8005C15.9488 13.0925 15.7619 13.6022 15.4323 13.6022H3.56862Z"
                stroke="#EA4646"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
          title: t('Notifications'),
          hasSwitch: true,
          value: isNotificationsEnabled,
          onValueChange: setIsNotificationsEnabled,
        },
        {
          icon: (
            <Svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <Path d="M15.1797 9C15.4558 9 15.6797 8.77614 15.6797 8.5C15.6797 8.22386 15.4558 8 15.1797 8V9ZM15.125 8.5C15.125 12.1589 12.1589 15.125 8.5 15.125V16.125C12.7112 16.125 16.125 12.7112 16.125 8.5H15.125ZM8.5 15.125C4.84111 15.125 1.875 12.1589 1.875 8.5H0.875C0.875 12.7112 4.28883 16.125 8.5 16.125V15.125ZM1.875 8.5C1.875 4.84111 4.84111 1.875 8.5 1.875V0.875C4.28883 0.875 0.875 4.28883 0.875 8.5H1.875ZM8.5 1.875C12.1589 1.875 15.125 4.84111 15.125 8.5H16.125C16.125 4.28883 12.7112 0.875 8.5 0.875V1.875ZM8.5 15.125C8.23504 15.125 7.94321 15.0044 7.63418 14.7056C7.32275 14.4045 7.01945 13.9447 6.75389 13.3377C6.22343 12.1252 5.88281 10.4152 5.88281 8.5H4.88281C4.88281 10.5198 5.24 12.3723 5.83774 13.7385C6.13628 14.4209 6.50468 15.0045 6.93912 15.4246C7.37597 15.8469 7.90417 16.125 8.5 16.125V15.125ZM5.88281 8.5C5.88281 6.58477 6.22343 4.87476 6.75389 3.66227C7.01945 3.05529 7.32275 2.59548 7.63418 2.29439C7.9432 1.99564 8.23504 1.875 8.5 1.875V0.875C7.90417 0.875 7.37597 1.15311 6.93912 1.57544C6.50468 1.99545 6.13628 2.57907 5.83774 3.26145C5.24 4.62771 4.88281 6.4802 4.88281 8.5H5.88281ZM8.5 16.125C9.09583 16.125 9.62403 15.8469 10.0609 15.4246C10.4953 15.0045 10.8637 14.4209 11.1623 13.7385C11.76 12.3723 12.1172 10.5198 12.1172 8.5H11.1172C11.1172 10.4152 10.7766 12.1252 10.2461 13.3377C9.98055 13.9447 9.67725 14.4045 9.36582 14.7056C9.05679 15.0044 8.76496 15.125 8.5 15.125V16.125ZM12.1172 8.5C12.1172 6.4802 11.76 4.62771 11.1623 3.26145C10.8637 2.57907 10.4953 1.99545 10.0609 1.57544C9.62403 1.15311 9.09583 0.875 8.5 0.875V1.875C8.76496 1.875 9.0568 1.99564 9.36582 2.29439C9.67725 2.59548 9.98055 3.05529 10.2461 3.66227C10.7766 4.87476 11.1172 6.58477 11.1172 8.5H12.1172ZM1.375 9L15.1797 9V8L1.375 8L1.375 9Z" fill="#3B82F6" />
            </Svg>
          ),
          title: t('Language'),
          customElement: () => <LanguageToggle />
        }
      ],
    },
    {
      section: t('Support & About'),
      items: [
        {
          icon: (
            <Svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <Path
                d="M8.49932 11.1719V8.5M8.49933 5.82812V5.8951M15.6236 8.5C15.6236 9.52424 15.4076 10.498 15.0185 11.3782L15.625 15.6243L11.9865 14.7146C10.9557 15.2943 9.76612 15.625 8.49932 15.625C4.56467 15.625 1.375 12.435 1.375 8.5C1.375 4.56497 4.56467 1.375 8.49932 1.375C12.434 1.375 15.6236 4.56497 15.6236 8.5Z"
                stroke="#3B82F6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
          title: t('Help Center'),
          hasArrow: true,
          onPress: () => router.push("/help/help-center"),
        },
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M11.8752 1.8999V4.7499C11.8752 5.27457 12.3006 5.6999 12.8252 5.6999H15.6752M6.65025 5.6999H8.55025M6.65025 8.5499H12.3502M6.65025 11.3999H12.3502M14.2502 3.3249C13.8274 2.9466 13.3887 2.49791 13.1117 2.2065C12.9274 2.01258 12.6727 1.8999 12.4052 1.8999H5.22502C4.17569 1.8999 3.32503 2.75056 3.32502 3.79989L3.32495 15.1998C3.32494 16.2492 4.1756 17.0999 5.22494 17.0999L13.775 17.0999C14.8243 17.0999 15.675 16.2493 15.675 15.1999L15.6752 5.12819C15.6752 4.88527 15.5826 4.65176 15.414 4.47688C15.1022 4.1535 14.5816 3.62139 14.2502 3.3249Z"
                stroke="#444444"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
          title: t('Terms of Service'),
          hasArrow: true,
          onPress: () => router.push("terms"),
        },
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M9.50005 1.8999C7.36508 3.71504 6.02685 3.7999 3.80005 3.7999V11.1054C3.80005 14.0206 5.82862 14.7813 9.50005 17.0999C13.1715 14.7813 15.2001 14.0206 15.2001 11.1054C15.2001 8.19017 15.2001 3.7999 15.2001 3.7999C12.9733 3.7999 11.635 3.71504 9.50005 1.8999Z"
                stroke="#39BF39"
                strokeLinejoin="round"
              />
            </Svg>
          ),
          title: t('Privacy Policy'),
          hasArrow: true,
          onPress: () => router.push("privacy_policy"),
        },
        {
          icon: (
            <Svg width="19" height="19" viewBox="0 0 19 19" fill="none">
              <Path
                d="M17.0999 5.225C17.0999 6.79901 13.6973 8.075 9.4999 8.075C5.30254 8.075 1.8999 6.79901 1.8999 5.225M17.0999 5.225C17.0999 3.65099 13.6973 2.375 9.4999 2.375C5.30254 2.375 1.8999 3.65099 1.8999 5.225M17.0999 5.225V13.775C17.0999 15.349 13.6973 16.625 9.4999 16.625C5.30254 16.625 1.8999 15.349 1.8999 13.775V5.225M17.0999 9.5C17.0999 11.074 13.6973 12.35 9.4999 12.35C5.30254 12.35 1.8999 11.074 1.8999 9.5"
                stroke="black"
              />
            </Svg>
          ),
          title: t('Data & Storage'),
          hasArrow: true,
          onPress: () => router.push("storage"),
        },
      ],
    },
  ];

  const SettingsItem = ({ item }) => (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={() => item.onPress && item.onPress()}
    >
      <View style={styles.settingsItemLeft}>
        <View style={styles.itemIcon}>{item.icon}</View>
        <Text style={styles.itemTitle}>{item.title}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {item.hasArrow && <ArrowIcon />}
        {item.hasSwitch && (
          <Switch
            value={item.value}
            onValueChange={item.onValueChange}
            trackColor={{ false: "#DDDDDD", true: "#B3D4FF" }}
            thumbColor={item.value ? "#007AFF" : "#FFFFFF"}
          />
        )}
        {item.customElement && item.customElement()}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
       <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent} 
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('settings')}</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Text style={styles.profileEmoji}>👶</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Bok</Text>
            <Text style={styles.profileEmail}>john.doe@email.com</Text>
          </View>
        </View>

        {settingsItems.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            {section.items.map((item, itemIndex) => (
              <SettingsItem key={itemIndex} item={item} />
            ))}
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, 
  },
  scrollView: {
    flex: 1,
    paddingBottom: 50,
  },
scrollContent: {
  paddingBottom: 120, 
},


  languageToggle: {
    width: 64,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    padding: 2,
  },
  thToggle: {
    backgroundColor: '#F32626', 
  },
  enToggle: {
    backgroundColor: '#282D8F', 
  },
  languageToggleTrack: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    position: 'relative',
  },
  languageToggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbLeft: {
    left: 2,
  },
  thumbRight: {
    right: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 16,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFE0E6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileEmoji: {
    fontSize: 30,
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
  },
  profileEmail: {
    color: "#666",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#666",
    marginLeft: 16,
    marginBottom: 8,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemIcon: {
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
  },
  logoutButton: {
    padding: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  version: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
  },
});

export default SettingsScreen;