import { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, Text, Keyboard, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleTermsPress = () => {
    router.push('/auth/termsofservice');
  };

  const handlePrivacyPress = () => {
    router.push('/auth/privacypolicy');
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
      {/* Back Button */}
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
        <MaterialIcons name="arrow-back" size={24} color="#444444" />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Please fill in your details to create an account</Text>
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
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  validateEmail(value);
                }}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>
          
          {/* Password Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Create your password</Text>
            <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#BCBCBC"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  validatePassword(value);
                }}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#B4B4B4" 
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>

          {/* Confirm Password Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Confirm your password</Text>
            <View style={[styles.inputContainer, confirmPasswordError ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#BCBCBC"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  validateConfirmPassword(value);
                }}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#B4B4B4" 
                />
              </TouchableOpacity>
            </View>
            {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
          </View>
        </View>
        
        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[styles.customSwitch, isChecked && styles.customSwitchActive]}
              onPress={() => {
                setIsChecked(!isChecked);
                if (!isChecked) setTermsError('');
              }}
            >
              <View style={[styles.switchThumb, isChecked && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>
          <Text style={styles.termsText}>
            I agree to the{" "}
            <Text style={styles.linkText} onPress={handleTermsPress}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.linkText} onPress={handlePrivacyPress}>
              Privacy Policy
            </Text>
          </Text>
        </View>
        {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}
        
        {/* Sign Up Button */}
        {loading ? (
          <View style={styles.loadingButton}>
            <ActivityIndicator size="small" color="#fff" />
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
        
        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/auth/sign-in');
            }
          }}>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFF",
  },
  backButton: {
    position: 'absolute',
    top: 57,
    left: 14,
    width: 40,
    height: 27,
    zIndex: 10,
    justifyContent: 'center',
  },
  titleContainer: {
    marginTop: 110,
    marginBottom: 44,
    paddingHorizontal: 36,
  },
  title: {
    color: '#444444',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 6,
  },
  subtitle: {
    color: '#8C8C8C',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 22,
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
    marginBottom: 17,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 27,
    gap: 12,
  },
  switchContainer: {
    marginTop: 2,
  },
  customSwitch: {
    width: 36,
    height: 18,
    backgroundColor: '#D7D7D7',
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  customSwitchActive: {
    backgroundColor: '#49BCFF',
  },
  switchThumb: {
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  termsText: {
    flex: 1,
    color: '#BCBCBC',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 22,
  },
  linkText: {
    color: '#0000FF',
    textDecorationLine: 'underline',
  },
  signUpButton: {
    height: 47,
    backgroundColor: '#49BCFF',
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
  signUpText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  loadingButton: {
    height: 47,
    backgroundColor: '#49BCFF',
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#BCBCBC',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 22,
  },
  signInLink: {
    color: '#0000FF',
    fontSize: 13,
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