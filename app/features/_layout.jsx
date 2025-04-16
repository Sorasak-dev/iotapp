import { Stack } from "expo-router";

export default function FeaturesLayout() {
    return (
        <Stack
        screenOptions={{
          headerShown: false, 
        }}
      >
        <Stack.Screen name="chat"/>
        <Stack.Screen name="edit_profile"/>
        <Stack.Screen name="help"/>
        <Stack.Screen name="add-zone"/>
        </Stack>
    );
}