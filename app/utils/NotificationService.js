// app/utils/NotificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config/api';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  expoPushToken = null;
  notificationListener = null;
  responseListener = null;

  // Initialize notification service
  async initialize() {
    try {
      console.log('🔄 Initializing notification service...');
      
      // Register for push notifications
      const token = await this.registerForPushNotificationsAsync();
      if (token) {
        this.expoPushToken = token;
        console.log('✅ Push token received:', token.substring(0, 30) + '...');
        
        // Send token to backend
        await this.sendTokenToBackend(token);
        
        // Store token locally
        await AsyncStorage.setItem('expoPushToken', token);
      } else {
        console.log('⚠️ No push token received');
      }

      // Set up notification listeners
      this.setupNotificationListeners();
      
      return token;
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      return null;
    }
  }

  // Register for push notifications
  async registerForPushNotificationsAsync() {
    let token;

    console.log('📱 Platform:', Platform.OS);
    console.log('📱 Is Device:', Device.isDevice);

    if (Platform.OS === 'android') {
      console.log('🤖 Setting up Android notification channels...');
      
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('critical', {
        name: 'Critical Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('anomaly', {
        name: 'Anomaly Detection',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#FFA500',
        sound: 'default',
      });
    }

    if (Device.isDevice) {
      console.log('📱 Running on physical device');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('📋 Current permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('📋 Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('📋 Permission result:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permission not granted');
        return null;
      }
      
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        console.log('🔧 Project ID:', projectId);
        
        if (!projectId) {
          throw new Error('Project ID not found');
        }
        
        console.log('📡 Getting Expo push token...');
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('✅ Real Expo push token received');
      } catch (e) {
        console.error('❌ Error getting Expo push token:', e);
        // 🔥 ใช้ mock token ที่ backend รองรับ
        token = `ExponentPushToken[FALLBACK_${Date.now()}]`;
        console.log('🔄 Using fallback token');
      }
    } else {
      // 🔥 Simulator/Emulator - ใช้ mock token ที่ backend รองรับ
      console.log('📱 Running on simulator - using mock token');
      token = `ExponentPushToken[SIMULATOR_${Date.now()}]`;
    }

    console.log('📱 Final token:', token ? token.substring(0, 30) + '...' : 'null');
    return token;
  }

  // Send token to backend server
  async sendTokenToBackend(token) {
    try {
      console.log('🔄 Sending token to backend...');
      console.log('🌐 API Base URL:', API_BASE_URL);
      
      const authToken = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      
      console.log('🔑 Auth token exists:', !!authToken);
      console.log('👤 User ID exists:', !!userId);
      console.log('👤 User ID value:', userId);
      
      if (!authToken) {
        console.log('⚠️ No auth token found, skipping token registration');
        return;
      }

      // ✅ ถ้าไม่มี userId ให้พยายามดึงจาก token
      let finalUserId = userId;
      if (!finalUserId && authToken) {
        try {
          // Decode JWT token เพื่อเอา userId (แบบง่ายๆ ไม่ verify signature)
          const base64Url = authToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          
          const decoded = JSON.parse(jsonPayload);
          finalUserId = decoded.id;
          console.log('🔧 Extracted userId from token:', finalUserId);
          
          // เก็บ userId ใน AsyncStorage
          if (finalUserId) {
            await AsyncStorage.setItem('userId', finalUserId);
          }
        } catch (e) {
          console.error('❌ Error decoding token:', e);
        }
      }

      if (!finalUserId) {
        console.log('⚠️ No user ID available, skipping token registration');
        return;
      }

      const requestBody = {
        userId: finalUserId,
        expoPushToken: token,
        deviceInfo: {
          platform: Platform.OS,
          deviceName: Device.deviceName || 'Unknown Device',
          osVersion: Device.osVersion || 'Unknown',
        }
      };

      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${API_BASE_URL}/api/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Push token registered successfully:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to register push token:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error sending token to backend:', error);
      console.error('❌ Error details:', error.message);
    }
  }

  // Set up notification listeners
  setupNotificationListeners() {
    console.log('👂 Setting up notification listeners...');
    
    // Listen for notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification received
  handleNotificationReceived(notification) {
    const { title, body, data } = notification.request.content;
    
    console.log('📩 Handling received notification:', { title, body, data });
    
    // Store notification locally if needed
    this.storeNotificationLocally(notification);
  }

  // Handle user interaction with notification
  handleNotificationResponse(response) {
    const { notification } = response;
    const { data } = notification.request.content;
    
    console.log('👆 Handling notification response with data:', data);
    
    // Handle navigation based on notification data
    if (data?.anomalyId) {
      console.log('🔗 Navigate to anomaly:', data.anomalyId);
    } else if (data?.deviceId) {
      console.log('🔗 Navigate to device:', data.deviceId);
    }
  }

  // Store notification locally
  async storeNotificationLocally(notification) {
    try {
      const storedNotifications = await AsyncStorage.getItem('localNotifications');
      const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
      
      notifications.unshift({
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: new Date().toISOString(),
        read: false,
      });
      
      // Keep only last 100 notifications
      const limitedNotifications = notifications.slice(0, 100);
      
      await AsyncStorage.setItem('localNotifications', JSON.stringify(limitedNotifications));
      console.log('💾 Stored notification locally');
    } catch (error) {
      console.error('❌ Error storing notification locally:', error);
    }
  }

  // Send local notification (for testing)
  async sendLocalNotification(title, body, data = {}) {
    console.log('📤 Sending local notification:', { title, body, data });
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: { seconds: 1 },
    });
  }

  // Send test notification
  async sendTestNotification() {
    console.log('🧪 Sending test notification...');
    
    await this.sendLocalNotification(
      'Test Notification',
      'This is a test notification from EMIB app',
      { type: 'test' }
    );
  }

  // Schedule notification for anomaly detection
  async scheduleAnomalyNotification(anomalyData) {
    const channelId = anomalyData.severity === 'critical' ? 'critical' : 'anomaly';
    
    console.log('🚨 Scheduling anomaly notification:', anomalyData);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${anomalyData.severity.toUpperCase()} Alert`,
        body: `${anomalyData.type} detected on ${anomalyData.device_name}`,
        data: {
          anomalyId: anomalyData._id,
          deviceId: anomalyData.device_id,
          type: 'anomaly',
          severity: anomalyData.severity,
        },
        sound: 'default',
        priority: anomalyData.severity === 'critical' ? 'high' : 'normal',
      },
      trigger: { seconds: 1 },
      channelId: Platform.OS === 'android' ? channelId : undefined,
    });
  }

  // Get current push token
  async getCurrentToken() {
    if (this.expoPushToken) {
      return this.expoPushToken;
    }
    
    try {
      const storedToken = await AsyncStorage.getItem('expoPushToken');
      if (storedToken) {
        this.expoPushToken = storedToken;
        return storedToken;
      }
    } catch (error) {
      console.error('❌ Error getting stored token:', error);
    }
    
    return null;
  }

  // Clean up listeners
  cleanup() {
    console.log('🧹 Cleaning up notification listeners...');
    
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Get notification settings
  async getNotificationSettings() {
    const permissions = await Notifications.getPermissionsAsync();
    return {
      granted: permissions.status === 'granted',
      canAskAgain: permissions.canAskAgain,
      settings: permissions,
    };
  }

  // Request permissions
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;