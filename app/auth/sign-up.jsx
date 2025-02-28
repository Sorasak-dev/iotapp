import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, ActivityIndicator, Text, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message'; 

const API_URL = 'http://172.16.22.133:3000';
// ที่อยู่ipของแต่ละเครื่อง (ipconfig) แล้วดูตรง IPv4 Address 
// ถ้าต่อผ่าน wifi ดูที่ Wireless LAN adapter Wi-Fi: IPv4 Address
// ถ้าต่อผ่าน LAN ดูที่ Ethernet adapter Ethernet: IPv4 Address
// http://<your-ip>:3000

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();

  // ฟังก์ชันตรวจสอบ Email
  const validateEmail = (value) => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(value)) {
      setEmailError('Invalid email format');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  // ฟังก์ชันตรวจสอบ Password
  const validatePassword = (value) => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    } else if (value.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  // ฟังก์ชันแสดง Toast
  const showToast = (type, title, message) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
    });
  };

  // ฟังก์ชัน Sign Up
  const handleSignUp = async () => {
    // ปิด Keyboard
    Keyboard.dismiss();

    // ตรวจสอบ Validation
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    if (!isEmailValid || !isPasswordValid) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', 'Signup Successful', 'You can now sign in to your account.');
        router.push('/auth/sign-in'); // กลับไปหน้า Sign In
      } else if (response.status === 409) {
        showToast('error', 'Signup Failed', 'Email already exists.');
      } else if (response.status === 400) {
        showToast('error', 'Signup Failed', 'Invalid input. Please try again.');
      } else {
        showToast('error', 'Signup Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      showToast('error', 'Network Error', error.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, emailError ? styles.inputError : null]}
        placeholder="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          validateEmail(value);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <TextInput
        style={[styles.input, passwordError ? styles.inputError : null]}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          validatePassword(value);
        }}
      />
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Signing up...</Text>
        </View>
      ) : (
        <Button title="Sign Up" onPress={handleSignUp} disabled={loading} />
      )}

      <View style={styles.spacer} />
      <Button title="Back to Sign In" onPress={() => router.push('/auth/sign-in')} />

      {/* Toast Notification */}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginBottom: 10,
  },
  spacer: {
    height: 10,
  },
  loadingContainer: { alignItems: 'center', marginVertical: 10 },
  loadingText: { marginTop: 10, color: '#555' },
});
