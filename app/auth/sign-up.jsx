import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, ActivityIndicator, Text, Keyboard, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { API_ENDPOINTS, API_TIMEOUT } from '../utils/config/api';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [termsError, setTermsError] = useState('');
  const router = useRouter();

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

  const validateConfirmPassword = (value) => {
    if (!value) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    } else if (value !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    } else {
      setConfirmPasswordError('');
      return true;
    }
  };

  const validateTerms = () => {
    if (!isChecked) {
      setTermsError('You must agree to the Terms of Service and Privacy Policy');
      return false;
    } else {
      setTermsError('');
      return true;
    }
  };

  const showToast = (type, title, message) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
    });
  };

  const handleSignUp = async () => {
    Keyboard.dismiss();

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);
    const isTermsValid = validateTerms();
    
    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid || !isTermsValid) return;

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(API_ENDPOINTS.SIGNUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok) {
        showToast('success', 'Signup Successful', 'You can now sign in to your account.');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/auth/sign-in');
        }
      } else if (response.status === 409) {
        showToast('error', 'Signup Failed', 'Email already exists.');
      } else if (response.status === 400) {
        showToast('error', 'Signup Failed', 'Invalid input. Please try again.');
      } else {
        showToast('error', 'Signup Failed', data.message || 'Something went wrong.');
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
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.push('/auth/sign-in');
          }
        }}
      >
        <MaterialIcons name="arrow-back" size={24} color="black" />
      </TouchableOpacity>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.welcomeText}>Welcome!</Text>
      <Text style={styles.subtitle}>Please fill in your details to create an account</Text>
      
      <Text style={styles.label}>Email</Text>
      <TextInput 
        style={[styles.input, emailError ? styles.inputError : null]} 
        placeholder="Enter your email" 
        keyboardType="email-address"
        autoCapitalize="none" 
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          validateEmail(value);
        }}
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
      
      <Text style={styles.label}>Password</Text>
      <TextInput 
        style={[styles.input, passwordError ? styles.inputError : null]} 
        placeholder="Create a password" 
        secureTextEntry
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          validatePassword(value);
        }} 
      />
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
      
      <Text style={styles.label}>Confirm Password</Text>
      <TextInput 
        style={[styles.input, confirmPasswordError ? styles.inputError : null]} 
        placeholder="Confirm your password" 
        secureTextEntry
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          validateConfirmPassword(value);
        }}
      />
      {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
      
      <View style={styles.termsContainer}>
        <Switch 
          value={isChecked} 
          onValueChange={(value) => {
            setIsChecked(value);
            if (value) setTermsError('');
          }} 
        />
        <Text style={styles.termsText}>
          I agree to the <Text style={styles.linkText}>Terms of Service</Text> and{" "}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
      {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}
      
      {/* ปุ่ม Sign Up */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Signing up...</Text>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.signUpButton} 
          onPress={handleSignUp} 
          disabled={loading}
        >
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
      )}
      
      <Text style={styles.orText}>or continue with</Text>
      
      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity style={styles.socialButton}>
          <FontAwesome name="google" size={20} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton}>
          <FontAwesome name="apple" size={20} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton}>
          <FontAwesome name="facebook" size={20} color="black" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.loginText}>
        Already have an account?{" "}
        <Text 
          style={styles.loginLink}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/auth/sign-in');
            }
          }}
        >
          Sign In
        </Text>
      </Text>

      {/* Toast Notification */}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 22,
    backgroundColor: "#fff",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 10,
    marginTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "gray",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
  },
  input: {
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginTop: 5,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 5,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  termsText: {
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  linkText: {
    color: "blue",
  },
  signUpButton: {
    width: "100%",
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 15,
  },
  signUpText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  orText: {
    textAlign: "center",
    marginVertical: 15,
    color: "gray",
  },
  socialButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
  },
  socialButton: {
    marginHorizontal: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
  },
  loginText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: "center",
  },
  loginLink: {
    color: "blue",
    fontWeight: "bold",
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  loadingText: {
    marginTop: 10,
    color: '#555',
  },
});