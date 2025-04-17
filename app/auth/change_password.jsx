// D:\y3\งานจารออย\iotapp\app\auth\change_password.jsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '../utils/config/api'; // นำเข้า API_BASE_URL

const ChangePasswordScreen = () => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const isValidNewPassword = formData.newPassword.length >= 8;
    const isValidConfirmPassword = formData.newPassword === formData.confirmPassword
        && formData.confirmPassword.length > 0;

    const handleSave = async () => {
        setErrorMessage('');
        if (!formData.currentPassword) {
            setErrorMessage('Please enter your current password');
            return;
        }
        if (!isValidNewPassword) {
            setErrorMessage('New password must be at least 8 characters');
            return;
        }
        if (!isValidConfirmPassword) {
            setErrorMessage('New password and confirm password do not match');
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('No token found. Please log in again.');
            }

            const response = await fetch(`${API_BASE_URL}/api/users/change-password`, { // ใช้ API_BASE_URL
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    oldPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                }),
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Unexpected response format: ${text.substring(0, 50)}...`);
            }

            const data = await response.json();

            if (response.ok) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Password changed successfully',
                });
                router.back();
            } else {
                throw new Error(data.message || 'Error changing password');
            }
        } catch (error) {
            const message = error.message || 'Failed to connect to the server';
            setErrorMessage(message);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.push('/tabs/settings')}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.headerTitle}>Password</Text>
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Current Password</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            value={formData.currentPassword}
                            onChangeText={(text) => setFormData({ ...formData, currentPassword: text })}
                            placeholder="Enter current password"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputWithIcon}>
                            <TextInput
                                style={[styles.input, styles.inputFlex]}
                                secureTextEntry
                                value={formData.newPassword}
                                onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
                                placeholder="Enter new password"
                                placeholderTextColor="#999"
                            />
                            {isValidNewPassword && (
                                <Text style={styles.checkIcon}>✓</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Confirm New Password</Text>
                        <View style={styles.inputWithIcon}>
                            <TextInput
                                style={[styles.input, styles.inputFlex]}
                                secureTextEntry
                                value={formData.confirmPassword}
                                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                                placeholder="Confirm new password"
                                placeholderTextColor="#999"
                            />
                            {isValidConfirmPassword && (
                                <Text style={styles.checkIcon}>✓</Text>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => router.push('/auth/forgot_password')}>
                        <Text style={styles.forgotText}>Forget Password</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        (!isValidNewPassword || !isValidConfirmPassword) && styles.saveButtonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={loading || !isValidNewPassword || !isValidConfirmPassword}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>
            <Toast />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    backButton: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 16,
        marginBottom: 24,
    },
    formContainer: {
        gap: 20,
    },
    inputContainer: {
        gap: 8,
        marginLeft: 24,
        marginRight: 24,
    },
    label: {
        fontSize: 14,
        color: '#666',
    },
    input: {
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
        paddingVertical: 8,
        fontSize: 16,
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    inputFlex: {
        flex: 1,
    },
    checkIcon: {
        color: '#4CD964',
        fontSize: 20,
        fontWeight: 'bold',
    },
    forgotText: {
        color: '#2D7CFF',
        fontSize: 14,
        marginLeft: 24,
        marginRight: 24,
    },
    saveButton: {
        display: 'flex',
        backgroundColor: '#2D7CFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        width: '50%',
        alignSelf: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#B3D4FF',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: 'red',
        fontSize: 14,
        marginBottom: 10,
        marginLeft: 24,
    },
});

export default ChangePasswordScreen;