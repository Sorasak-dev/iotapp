import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
} from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';

const ChangePasswordScreen = () => {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const BackIcon = () => (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path
                d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18"
                stroke="#000"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );

    const CheckIcon = () => (
        <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <Circle cx="10" cy="10" r="10" fill="#4CD964" />
            <Path
                d="M5 10L8.5 13.5L15 7"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );

    const isValidNewPassword = formData.newPassword.length >= 8;
    const isValidConfirmPassword = formData.newPassword === formData.confirmPassword
        && formData.confirmPassword.length > 0;

    const handleSave = () => {
        // Handle save functionality
        console.log('Saving new password');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('settings')}>
                        <BackIcon />
                    </TouchableOpacity>
                </View>
                <Text style={styles.headerTitle}>Password</Text>
                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
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
                            {isValidNewPassword && <CheckIcon />}
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputWithIcon}>
                            <TextInput
                                style={[styles.input, styles.inputFlex]}
                                secureTextEntry
                                value={formData.confirmPassword}
                                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                                placeholder="Confirm new password"
                                placeholderTextColor="#999"
                            />
                            {isValidConfirmPassword && <CheckIcon />}
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => navigation.navigate('forget_password')}>
                        <Text style={styles.forgotText}>Forget Password</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        (!isValidNewPassword || !isValidConfirmPassword) && styles.saveButtonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={!isValidNewPassword || !isValidConfirmPassword}
                >
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>
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
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 16,
        marginBottom: 24
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
});

export default ChangePasswordScreen;
