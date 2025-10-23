import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons'; 
import { API_BASE_URL } from '../utils/config/api';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [show, setShow] = useState({
    current: false,
    newPw: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const isValidCurrent = form.currentPassword.trim().length > 0;
  const isValidNew =
    form.newPassword.length >= 8 && form.newPassword !== form.currentPassword;
  const isValidConfirm =
    form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;

  const isFormValid = useMemo(
    () => isValidCurrent && isValidNew && isValidConfirm,
    [isValidCurrent, isValidNew, isValidConfirm]
  );

  const setField = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setErrorMessage(null);

    if (!isValidCurrent) {
      setErrorMessage('Please enter your current password');
      return;
    }
    if (!isValidNew) {
      setErrorMessage(
        form.newPassword === form.currentPassword
          ? 'New password must be different from current password'
          : 'New password must be at least 8 characters'
      );
      return;
    }
    if (!isValidConfirm) {
      setErrorMessage('New password and confirm password do not match');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found. Please log in again.');

      const res = await fetch(`${API_BASE_URL}/api/users/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json()
        : null;

      if (!res.ok) {
        const msg =
          (payload && (payload.message || payload.error)) ||
          `Error changing password (status ${res.status})`;
        throw new Error(msg);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Password changed successfully',
      });
      router.back();
    } catch (err) {
      const msg = err?.message || 'Failed to change password';
      setErrorMessage(msg);
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const renderEyeIcon = (isVisible, toggleFn) => (
    <TouchableOpacity onPress={toggleFn}>
      <MaterialIcons
        name={isVisible ? 'visibility' : 'visibility-off'}
        size={22}
        color="#a8a8a8ff"
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Password</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {/* Current Password */}
        <View style={styles.section}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Enter current password"
              placeholderTextColor="#d3d3d3ff"
              value={form.currentPassword}
              secureTextEntry={!show.current}
              onChangeText={(t) => setField('currentPassword', t)}
            />
            {renderEyeIcon(show.current, () =>
              setShow((s) => ({ ...s, current: !s.current }))
            )}
          </View>
        </View>

        {/* New Password */}
        <View style={styles.section}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Enter new password"
              placeholderTextColor="#d3d3d3ff"
              value={form.newPassword}
              secureTextEntry={!show.newPw}
              onChangeText={(t) => setField('newPassword', t)}
            />
            {renderEyeIcon(show.newPw, () =>
              setShow((s) => ({ ...s, newPw: !s.newPw }))
            )}
          </View>
          <Text style={styles.hint}>
            Must be at least 8 characters
            {form.newPassword === form.currentPassword
              ? ' • must differ from current password'
              : ''}
          </Text>
        </View>

        {/* Confirm New Password */}
        <View style={styles.section}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Confirm new password"
              placeholderTextColor="#d3d3d3ff"
              value={form.confirmPassword}
              secureTextEntry={!show.confirm}
              onChangeText={(t) => setField('confirmPassword', t)}
            />
            {renderEyeIcon(show.confirm, () =>
              setShow((s) => ({ ...s, confirm: !s.confirm }))
            )}
          </View>
        </View>

        <TouchableOpacity onPress={() => router.push('/auth/forgot_password')}>
          <Text style={styles.link}>Forget Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, (!isFormValid || loading) && styles.saveBtnDisabled]}
          disabled={!isFormValid || loading}
          onPress={handleSave}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveTxt}>Save</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  backIcon: { fontSize: 24, fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: '800', marginLeft: 16, marginBottom: 24 },
  section: { marginHorizontal: 24, marginBottom: 20 },
  label: { fontSize: 15, color: '#5F6368', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingVertical: 10, fontSize: 16 },
  inputFlex: { flex: 1 },
  link: { color: '#2D7CFF', fontSize: 14, marginLeft: 24, marginTop: 2 },
  hint: { fontSize: 12, color: '#8A8A8A', marginTop: 6 },
  saveBtn: {
    backgroundColor: '#2D7CFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 28,
    width: '55%',
    alignSelf: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#B3D4FF' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: 'red', fontSize: 14, marginLeft: 24, marginBottom: 10 },
});
