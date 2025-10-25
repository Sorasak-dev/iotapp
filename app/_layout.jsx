import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import notificationService from './utils/NotificationService';

export default function RootLayout() {
  useEffect(() => {
    console.log('[RootLayout] Initializing notification service...');
    
    const initNotifications = async () => {
      try {
        await notificationService.initialize();
        console.log('[RootLayout] Notification service initialized');
      } catch (error) {
        console.error('[RootLayout] Failed to initialize notifications:', error);
      }
    };
    
    initNotifications();
    
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}