import { Stack } from 'expo-router';

export default function NotificationsLayout() {
    return (
        <Stack
        screenOptions={{
          headerShown: false, 
        }}
      >
            <Stack.Screen name="error-history"/>
            <Stack.Screen name="notification"/>
        </Stack>
    );
}