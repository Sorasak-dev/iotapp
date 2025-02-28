import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message'; 

const API_URL = 'http://192.168.1.12:3000';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();

  

  // ฟังก์ชันแสดง Toast
  const showToast = (type, title, message) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
    });
  };

  // ฟังก์ชันตรวจสอบ Validation
  const validateFields = () => {
    let valid = true;

    if (!email) {
      setEmailError('Email is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Invalid email format');
      valid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else {
      setPasswordError('');
    }

    return valid;
  };

  // ฟังก์ชัน Sign In
  const handleSignIn = async () => {
    // ปิด Keyboard
    Keyboard.dismiss();

    if (!validateFields()) return;

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      showToast('error', 'No Internet Connection', 'Please check your connection and try again.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('email', email);

        showToast('success', 'Login Successful', 'You have successfully signed in.');
        router.push('/tabs/home');
      } else if (response.status === 401) {
        showToast('error', 'Login Failed', 'Invalid email or password.');
      } else {
        showToast('error', 'Login Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      showToast('error', 'Network Error', error.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      {/* Email Input */}
      <TextInput
        style={[styles.input, emailError ? styles.inputError : null]}
        placeholder="Email"
        value={email}
        onChangeText={(value) => setEmail(value)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus={emailError ? true : false}
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      {/* Password Input */}
      <TextInput
        style={[styles.input, passwordError ? styles.inputError : null]}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={(value) => setPassword(value)}
        autoFocus={passwordError ? true : false}
      />
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

      {/* Loading or Sign In Button */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      )}

      {/* Spacer and Navigation */}
      <View style={styles.spacer} />
      <TouchableOpacity onPress={() => router.push('/auth/sign-up')} disabled={loading}>
        <Text style={styles.linkText}>Go to Sign Up</Text>
      </TouchableOpacity>

      {/* Toast Notification */}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginBottom: 10,
  },
  spacer: { height: 10 },
  loadingContainer: { alignItems: 'center', marginVertical: 10 },
  loadingText: { marginTop: 10, color: '#555' },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  linkText: {
    color: '#1E90FF',
    textAlign: 'center',
    fontSize: 16,
  },
});
