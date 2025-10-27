import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { PushNotificationService } from '../utils/config/api';
import notificationService from '../utils/NotificationService';

export default function NotificationSettings({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    enabled: true,
    anomalyAlerts: true,
    criticalOnly: false,
    deviceAlerts: true,
    systemAlerts: true,
    soundEnabled: true,
    vibrationEnabled: true,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
  });
  const [notificationStatus, setNotificationStatus] = useState(null);
  const [needsTokenRegistration, setNeedsTokenRegistration] = useState(false);

  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    await checkNotificationStatus();
    await loadPreferences();
  };

  const checkNotificationStatus = async () => {
    try {
      const status = await notificationService.getNotificationSettings();
      setNotificationStatus(status);
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const registerPushToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No auth token found');
        return false;
      }

      let userId;
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          userId = userData.id;
        }
      } catch (e) {
        console.warn('Could not get user ID from stored data');
      }

      if (!userId) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.id;
        } catch (e) {
          console.error('Could not get user ID from token');
          return false;
        }
      }

      let expoPushToken;
      
      if (!Device.isDevice) {
        expoPushToken = `ExponentPushToken[SIMULATOR_${Date.now()}]`;
        console.log('📱 Running on simulator - using mock token');
      } else {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          expoPushToken = tokenData.data;
        } catch (error) {
          console.warn('Failed to get real push token, using mock token');
          expoPushToken = `ExponentPushToken[FALLBACK_${Date.now()}]`;
        }
      }

      if (!expoPushToken) {
        console.error('Failed to get Expo push token');
        return false;
      }

      const deviceInfo = {
        platform: Device.osName?.toLowerCase() || 'unknown',
        deviceName: Device.deviceName || 'Unknown Device',
        osVersion: Device.osVersion || 'Unknown',
        appVersion: Constants.expoConfig?.version || '1.0.0',
        deviceId: Device.osBuildId || Device.osInternalBuildId || 'unknown'
      };

      console.log('🔄 Registering push token...', { 
        userId, 
        expoPushToken: expoPushToken.substring(0, 30) + '...' 
      });

      const response = await PushNotificationService.registerToken(
        token,
        userId,
        expoPushToken,
        deviceInfo
      );

      if (response.success) {
        console.log('✅ Push token registered successfully');
        setNeedsTokenRegistration(false);
        return true;
      } else {
        console.error('❌ Failed to register push token:', response.error);
        return false;
      }

    } catch (error) {
      console.error('❌ Error registering push token:', error);
      return false;
    }
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      if (token) {
        console.log('🔄 Loading preferences from server...');
        const response = await PushNotificationService.getPreferences(token);
        
        if (response.success && response.data) {
          console.log('✅ Loaded preferences from server');
          setPreferences({ ...preferences, ...response.data });
          setNeedsTokenRegistration(false);
        } else if (response.needsRegistration || response.error === 'No preferences found') {
          console.log('⚠️ User needs to register push token first');
          setNeedsTokenRegistration(true);
          
          console.log('🔄 Attempting auto-registration...');
          const registered = await registerPushToken();
          if (registered) {
            console.log('🔄 Retrying to load preferences after registration...');
            const retryResponse = await PushNotificationService.getPreferences(token);
            if (retryResponse.success && retryResponse.data) {
              console.log('✅ Loaded preferences after registration');
              setPreferences({ ...preferences, ...retryResponse.data });
              setNeedsTokenRegistration(false);
            }
          }
        } else {
          console.warn('⚠️ Failed to load server preferences:', response.error);
          setNeedsTokenRegistration(true);
          await loadLocalPreferences();
        }
      } else {
        console.log('⚠️ No auth token found, loading from local storage');
        await loadLocalPreferences();
      }
    } catch (error) {
      console.error('❌ Error loading preferences:', error);
      setNeedsTokenRegistration(true);
      await loadLocalPreferences();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalPreferences = async () => {
    try {
      const savedPreferences = await AsyncStorage.getItem('notificationPreferences');
      if (savedPreferences) {
        console.log('✅ Loaded preferences from local storage');
        setPreferences({ ...preferences, ...JSON.parse(savedPreferences) });
      } else {
        console.log('ℹ️ No local preferences found, using defaults');
      }
    } catch (error) {
      console.error('❌ Error loading local preferences:', error);
    }
  };

  const savePreferences = async (newPreferences) => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('token');
      
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(newPreferences));
      console.log('✅ Saved preferences locally');
      
      if (token) {
        if (needsTokenRegistration) {
          console.log('🔄 Registering push token before saving...');
          const registered = await registerPushToken();
          if (!registered) {
            console.warn('⚠️ Failed to register push token, saving locally only');
            setPreferences(newPreferences);
            return;
          }
          setNeedsTokenRegistration(false);
        }

        console.log('🔄 Saving preferences to server...');
        const response = await PushNotificationService.updatePreferences(token, newPreferences);
        if (!response.success) {
          console.warn('⚠️ Failed to save to server:', response.error);
          if (response.error.includes('404') || response.error.includes('token')) {
            setNeedsTokenRegistration(true);
          }
        } else {
          console.log('✅ Saved preferences to server');
        }
      }
      
      setPreferences(newPreferences);
      
    } catch (error) {
      console.error('❌ Error saving preferences:', error);
      console.warn('⚠️ Preferences saved locally only');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  };

  const requestNotificationPermission = async () => {
    try {
      const granted = await notificationService.requestPermissions();
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted');
        await checkNotificationStatus();
        
        if (needsTokenRegistration) {
          const registered = await registerPushToken();
          if (registered) {
            await loadPreferences(); 
          }
        }
        return granted;
      } else {
        Alert.alert('Permission Denied', 'Notification permissions are required for alerts');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
      return false;
    }
  };

  const sendTestNotification = async () => {
    try {
      await notificationService.sendTestNotification();
      Alert.alert('Test Sent', 'Check your notifications for the test message');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const sendServerTestNotification = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        if (needsTokenRegistration) {
          console.log('🔄 Registering token before sending test...');
          const registered = await registerPushToken();
          if (!registered) {
            Alert.alert('Error', 'Please register for notifications first');
            return;
          }
          setNeedsTokenRegistration(false);
        }

        console.log('🔄 Sending server test notification...');
        const response = await PushNotificationService.sendTestNotification(token);
        if (response.success) {
          Alert.alert('Test Sent', 'Server test notification sent');
        } else {
          Alert.alert('Error', response.error || 'Failed to send server test notification');
        }
      } else {
        Alert.alert('Error', 'Please sign in to send server test notification');
      }
    } catch (error) {
      console.error('Error sending server test notification:', error);
      Alert.alert('Error', 'Failed to send server test notification');
    }
  };

  const setupNotifications = async () => {
    try {
      console.log('🔄 Setting up notifications...');
      const granted = await requestNotificationPermission();
      if (granted) {
        const registered = await registerPushToken();
        if (registered) {
          Alert.alert('Success', 'Notifications have been set up successfully!');
          await loadPreferences(); 
        } else {
          Alert.alert('Error', 'Failed to set up notifications. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      Alert.alert('Error', 'Failed to set up notifications');
    }
  };

  const SettingRow = ({ title, subtitle, value, onValueChange, disabled = false }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || saving}
        trackColor={{ false: '#767577', true: '#81b0ff' }}
        thumbColor={value ? '#007BFF' : '#f4f3f4'}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      {/* Permission Status */}
      {notificationStatus && (
        <View style={styles.statusContainer}>
          <View style={styles.statusHeader}>
            <Ionicons 
              name={notificationStatus.granted ? "checkmark-circle" : "alert-circle"} 
              size={20} 
              color={notificationStatus.granted ? "#4CAF50" : "#FF9800"} 
            />
            <Text style={styles.statusTitle}>
              {notificationStatus.granted ? "Notifications Enabled" : "Notifications Disabled"}
            </Text>
          </View>
          
          {/* Show setup button if needs registration or permissions */}
          {(!notificationStatus.granted || needsTokenRegistration) && (
            <TouchableOpacity 
              style={styles.enableButton} 
              onPress={needsTokenRegistration ? setupNotifications : requestNotificationPermission}
            >
              <Text style={styles.enableButtonText}>
                {needsTokenRegistration ? "Setup Notifications" : "Enable Notifications"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Show warning if token registration is needed */}
      {needsTokenRegistration && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning-outline" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            Notification preferences will be saved locally until you set up push notifications.
          </Text>
        </View>
      )}

      {/* Main Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        
        <SettingRow
          title="Push Notifications"
          subtitle="Receive notifications on this device"
          value={preferences.enabled}
          onValueChange={(value) => handleToggle('enabled', value)}
          disabled={!notificationStatus?.granted}
        />
        
        <SettingRow
          title="Sound"
          subtitle="Play sound for notifications"
          value={preferences.soundEnabled}
          onValueChange={(value) => handleToggle('soundEnabled', value)}
          disabled={!preferences.enabled}
        />
        
        <SettingRow
          title="Vibration"
          subtitle="Vibrate for notifications"
          value={preferences.vibrationEnabled}
          onValueChange={(value) => handleToggle('vibrationEnabled', value)}
          disabled={!preferences.enabled}
        />
      </View>

      {/* Alert Types */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Types</Text>
        
        <SettingRow
          title="Anomaly Alerts"
          subtitle="Notifications for detected anomalies"
          value={preferences.anomalyAlerts}
          onValueChange={(value) => handleToggle('anomalyAlerts', value)}
          disabled={!preferences.enabled}
        />
        
        <SettingRow
          title="Critical Only"
          subtitle="Only receive critical severity alerts"
          value={preferences.criticalOnly}
          onValueChange={(value) => handleToggle('criticalOnly', value)}
          disabled={!preferences.enabled || !preferences.anomalyAlerts}
        />
        
        <SettingRow
          title="Device Alerts"
          subtitle="Notifications for device status changes"
          value={preferences.deviceAlerts}
          onValueChange={(value) => handleToggle('deviceAlerts', value)}
          disabled={!preferences.enabled}
        />
        
        <SettingRow
          title="System Alerts"
          subtitle="System maintenance and updates"
          value={preferences.systemAlerts}
          onValueChange={(value) => handleToggle('systemAlerts', value)}
          disabled={!preferences.enabled}
        />
      </View>

      {/* Quiet Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quiet Hours</Text>
        
        <SettingRow
          title="Enable Quiet Hours"
          subtitle="Silence notifications during specific hours"
          value={preferences.quietHoursEnabled}
          onValueChange={(value) => handleToggle('quietHoursEnabled', value)}
          disabled={!preferences.enabled}
        />
        
        {preferences.quietHoursEnabled && (
          <View style={styles.quietHoursContainer}>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>From:</Text>
              <Text style={styles.timeValue}>{preferences.quietStart}</Text>
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>To:</Text>
              <Text style={styles.timeValue}>{preferences.quietEnd}</Text>
            </View>
            <Text style={styles.quietHoursNote}>
              During quiet hours, only critical alerts will be shown
            </Text>
          </View>
        )}
      </View>

      {/* Test Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={sendTestNotification}
          disabled={!preferences.enabled}
        >
          <Ionicons name="notifications-outline" size={20} color="#007BFF" />
          <Text style={styles.testButtonText}>Send Local Test</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={sendServerTestNotification}
          disabled={!preferences.enabled}
        >
          <Ionicons name="cloud-outline" size={20} color="#007BFF" />
          <Text style={styles.testButtonText}>Send Server Test</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Ionicons name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.infoText}>
          Push notifications require an internet connection. Critical alerts may override quiet hours settings.
        </Text>
      </View>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color="#007BFF" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  closeButton: {
    padding: 8,
    marginRight: 12,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  statusContainer: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  statusTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  
  enableButton: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  enableButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  
  warningText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8A6914',
    flex: 1,
  },
  
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
  },
  
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  settingContent: {
    flex: 1,
  },
  
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  
  quietHoursContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  
  timeLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
  },
  
  timeValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  
  quietHoursNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  testButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#007BFF',
    fontWeight: '500',
  },
  
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  
  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    flex: 1,
  },
  
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  
  savingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007BFF',
  },
});