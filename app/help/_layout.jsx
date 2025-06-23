import { Stack } from "expo-router";

export default function HelpLayout() {
    return (
        <Stack
        screenOptions={{
          headerShown: false, 
        }}
      >
        <Stack.Screen name="about-us"/>
        <Stack.Screen name="connect-sensor"/>
        <Stack.Screen name="device-monitor"/>
        <Stack.Screen name="manage-zones"/>
        <Stack.Screen name="notification"/>
        <Stack.Screen name="statistics"/>
        </Stack>
    );
}