import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Keyboard, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from '../utils/config/api';
import notificationService from '../utils/NotificationService';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [secureText, setSecureText] = useState(true);
  const router = useRouter();

  const showToast = (type, title, message) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
    });
  };

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

  const handleSignIn = async () => {
    Keyboard.dismiss();

    if (!validateFields()) return;

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      showToast('error', 'No Internet Connection', 'Please check your connection and try again.');
      return;
    }

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(API_ENDPOINTS.SIGNIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('email', email);
        
        if (data.token) {
          try {
            const base64Url = data.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            
            const decoded = JSON.parse(jsonPayload);
            if (decoded.id) {
              await AsyncStorage.setItem('userId', decoded.id);
              console.log('[SignIn] UserId saved:', decoded.id);
            }
          } catch (e) {
            console.error('[SignIn] Error decoding token:', e);
          }
        }

        console.log('[SignIn] Re-initializing notification service after login...');
        try {
          await notificationService.initialize();
          console.log('[SignIn] Notification service re-initialized');
        } catch (notifError) {
          console.error('[SignIn] Failed to re-initialize notifications:', notifError);
        }

        showToast('success', 'Login Successful', 'You have successfully signed in.');
        router.push('/tabs/home');
      } else if (response.status === 401) {
        showToast('error', 'Login Failed', 'Invalid email or password.');
      } else {
        showToast('error', 'Login Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showToast('error', 'Timeout', 'Request took too long. Please try again.');
      } else {
        showToast('error', 'Network Error', error.message || 'Unable to connect to the server.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBackground}>
          <Image 
            source={require('../assets/logoiot.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      
      {/* Title and Subtitle */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>
      
      {/* Form Card */}
      <View style={styles.formCard}>
        <View style={styles.formContainer}>
          {/* Email Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#BCBCBC"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>
          
          {/* Password Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#BCBCBC"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureText}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
                <MaterialIcons name={secureText ? "visibility-off" : "visibility"} size={20} color="#B4B4B4" />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>
        </View>
        
        {/* Forgot Password */}
        <TouchableOpacity onPress={() => router.push('/auth/forgot_password')} disabled={loading}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>
        
        {/* Sign In Button */}
        {loading ? (
          <LinearGradient
            colors={['#49BCFF', '#007BFF']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.loadingButton}
          >
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingText}>Signing in...</Text>
          </LinearGradient>
        ) : (
          <TouchableOpacity onPress={handleSignIn}>
            <LinearGradient
              colors={['#49BCFF', '#007BFF']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.signInButton}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/sign-up')} disabled={loading}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Toast Notification */}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFF",
    position: 'relative',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 124,
    marginBottom: 40,
  },
  logoBackground: {
    width: 82,
    height: 79,
    backgroundColor: '#49BCFF',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 71,
    height: 72,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 58,
    paddingHorizontal: 36,
  },
  title: {
    color: '#444444',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8C8C8C',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  formCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    paddingHorizontal: 37,
    paddingTop: 23,
    paddingBottom: 47,
    shadowColor: "rgba(196, 196, 196, 0.25)",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 13,
    elevation: 8,
  },
  formContainer: {
    gap: 22,
  },
  fieldContainer: {
    gap: 9,
  },
  label: {
    color: '#444444',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  inputContainer: {
    height: 47,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FCFCFC',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CACACA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#444444',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  passwordInput: {
    flex: 1,
    color: '#444444',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  eyeIcon: {
    padding: 2,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: '#0000FF',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 9,
    marginBottom: 21,
  },
  signInButton: {
    height: 47,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  loadingButton: {
    height: 47,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 13,
    opacity: 0.8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    color: '#BCBCBC',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  signUpLink: {
    color: '#0000FF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  inputError: {
    borderColor: '#e74c3c',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
});