import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message'; // เพิ่ม Toast

// Import หน้าต่างๆ
import SignUp from './app/auth/sign-up';
import SignIn from './app/auth/sign-in';

// Tab Navigator
const Tab = createBottomTabNavigator();

const HomeScreen = () => (
  <View style={styles.screen}>
    <Text>Home Screen</Text>
  </View>
);

const Device_MonitorScreen = () => (
  <View style={styles.screen}>
    <Text>Device_Monitor Screen</Text>
  </View>
);

const SettingsScreen = () => (
  <View style={styles.screen}>
    <Text>Settings Screen</Text>
  </View>
);

const NotificationsScreen = () => (
  <View style={styles.screen}>
    <Text>Notifications Screen</Text>
  </View>
);

// Custom Tab Icon
function CustomTabBarIcon({ focused, iconName }) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
      <Ionicons name={iconName} size={24} color={focused ? '#000' : '#fff'} />
    </View>
  );
}

// Tab Navigator Component
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: '#467fcf',
          height: 70,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          position: 'absolute',
        },
        tabBarShowLabel: false,
        headerTitleAlign: 'center', // เพิ่มการตั้งค่า Header
        tabBarIcon: ({ focused }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home-outline';
          } else if (route.name === 'Statistics') {
            iconName = 'pie-chart-outline';
          } else if (route.name === 'Settings') {
            iconName = 'settings-outline';
          } else if (route.name === 'Notifications') {
            iconName = 'notifications-outline';
          }
          return <CustomTabBarIcon focused={focused} iconName={iconName} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerTitle: 'Home' }} />
      <Tab.Screen
        name="Device_Monitor"
        component={Device_MonitorScreen}
        options={{ headerTitle: 'Device_Monitor' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerTitle: 'Settings' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerTitle: 'Notifications' }}
      />
    </Tab.Navigator>
  );
}

// Stack Navigator
const Stack = createStackNavigator();

export default function App() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="SignIn">
          {/* หน้า Sign In และ Sign Up */}
          <Stack.Screen name="SignIn" component={SignIn} options={{ headerTitle: 'Sign In' }} />
          <Stack.Screen name="SignUp" component={SignUp} options={{ headerTitle: 'Sign Up' }} />
          {/* หลังจากล็อกอิน จะเข้าสู่ Tab Navigator */}
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Toast Notification */}
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  iconWrapperFocused: {
    backgroundColor: '#c4d4e3', // สีพื้นหลังของปุ่มเมื่อถูกเลือก
    marginTop: -20, // ดึงไอคอนขึ้นมาให้ดูโดดเด่น
  },
});
