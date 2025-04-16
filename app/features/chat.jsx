import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const ChatScreen = () => {
    const router = useRouter();
    const [messageText, setMessageText] = useState('');
    
    // ข้อความตัวอย่าง (ในแอพจริงอาจดึงจาก API หรือฐานข้อมูล)
    const messages = [
        {
            id: '1',
            text: 'I can see you have elevated readings. Would you like me to check the calibration?',
            isSupport: true,
            timestamp: '10:31 AM'
        },
        {
            id: '2',
            text: 'Yes, please. The temperature seems higher than usual.',
            isSupport: false,
            timestamp: '10:32 AM'
        }
    ];

    // ฟังก์ชันสำหรับการย้อนกลับ
    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/help');
        }
    };

    // ฟังก์ชันสำหรับการส่งข้อความ
    const handleSend = () => {
        if (messageText.trim().length === 0) return;
        
        // ในแอพจริงคุณจะส่งข้อความไปยัง API
        console.log('Sending message:', messageText);
        
        // เคลียร์ข้อความหลังจากส่ง
        setMessageText('');
    };

    // แสดงข้อความแต่ละรายการ
    const renderMessageItem = ({ item }) => (
        <View style={item.isSupport ? styles.userMessageContainer : styles.supportMessageContainer}>
            <Text style={item.isSupport ? styles.userMessage : styles.supportMessage}>
                {item.text}
            </Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat with Support</Text>
            </View>

            <View style={styles.chatContainer}>
                <Text style={styles.connectionStatus}>
                    Connected to Sensor ID: IOT-001
                </Text>

                <FlatList
                    style={styles.messagesContainer}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    inverted={false}
                />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.inputContainer}
                keyboardVerticalOffset={100}
            >
                <TouchableOpacity style={styles.attachButton}>
                    <Ionicons name="attach" size={24} color="#666" />
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    placeholder="Type your message"
                    placeholderTextColor="#999"
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                />
                <TouchableOpacity 
                    style={[
                        styles.sendButton, 
                        messageText.trim().length === 0 && styles.sendButtonDisabled
                    ]}
                    onPress={handleSend}
                    disabled={messageText.trim().length === 0}
                >
                    <Ionicons 
                        name="send" 
                        size={24} 
                        color={messageText.trim().length === 0 ? "#ccc" : "#007AFF"} 
                    />
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
        maxHeight: 100,
    },
    sendButton: {
        marginLeft: 8,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    }
});

export default ChatScreen;