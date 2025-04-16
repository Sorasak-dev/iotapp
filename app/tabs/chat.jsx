import React from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
const ChatScreen = () => {
    const navigationPart = useNavigation();
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigationPart.navigate('help')}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat with Support</Text>
            </View>

            <View style={styles.chatContainer}>
                <Text style={styles.connectionStatus}>
                    Connected to Sensor ID: IOT-001
                </Text>

                <View style={styles.messagesContainer}>
                    <View style={styles.userMessageContainer}>
                        <Text style={styles.userMessage}>
                            I can see you have elevated readings. Would you like me to check the calibration?
                        </Text>
                        <Text style={styles.timestamp}>10:31 AM</Text>
                    </View>

                    <View style={styles.supportMessageContainer}>
                        <Text style={styles.supportMessage}>
                            Yes, please. The temperature seems higher than usual.
                        </Text>
                        <Text style={styles.timestamp}>10:32 AM</Text>
                    </View>
                </View>
            </View>


            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.inputContainer}
            >
                <TouchableOpacity style={styles.attachButton}>
                    <Ionicons name="attach" size={24} color="#666" />
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    placeholder="Type your message"
                    placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.sendButton}>
                    <Ionicons name="send" size={24} color="#007AFF" />
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    chatContainer: {
        flex: 1,
        padding: 16,
    },
    connectionStatus: {
        textAlign: 'center',
        color: '#666',
        fontSize: 12,
        marginBottom: 16,
    },
    messagesContainer: {
        flex: 1,
    },
    userMessageContainer: {
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    supportMessageContainer: {
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    userMessage: {
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 16,
        maxWidth: '80%',
        marginBottom: 4,
    },
    supportMessage: {
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 16,
        maxWidth: '80%',
        color: '#fff',
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 10,
        color: '#666',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    attachButton: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        marginTop: -140,
    },
    sendButton: {
        marginLeft: 8,
        marginTop: -140,
    },
});

export default ChatScreen;