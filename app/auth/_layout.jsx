import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, 
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="change_password" />
      <Stack.Screen name="forgot_password" />
      <Stack.Screen name="privacypolicy" />
      <Stack.Screen name="termsofservice" />
    </Stack>
  );
}