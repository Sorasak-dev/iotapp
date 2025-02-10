import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#467fcf',
          height: 70,
        },
        headerShown: false,
      }}
    />
  );
}
