import { Stack } from 'expo-router';

export default function DevicesLayout() {
    return (
        <Stack
      screenOptions={{
        headerShown: false, 
      }}
    >
            <Stack.Screen name="sensor-detail"/>      
            <Stack.Screen name="device-monitor"/>
            <Stack.Screen name="selectdevice"/>
            <Stack.Screen name="full-chart"/>
            <Stack.Screen name="error-history"/>
            <Stack.Screen name="edit-device"/>
        </Stack>
    );
}