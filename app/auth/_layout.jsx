import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // ซ่อน Header ของ Stack (หากไม่ต้องการแสดง)
      }}
    />
  );
}
