import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS, getAuthHeaders, API_TIMEOUT } from '../utils/config/api';

export default function AddZone() {
  const { t } = useTranslation();
  const router = useRouter();
  const [zoneName, setZoneName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [profileImage, setProfileImage] = useState(null);

  const handleGoBack = () => {
    router.back();
  };

  const handleChangeProfileImage = () => {
    Alert.alert(
      t("Profile Image"),
      t("This would open an image picker in a real app")
    );
  };

  const handleSaveZone = async () => {
    try {
      if (!zoneName.trim()) {
        Alert.alert(t("Error"), t("Please enter a zone name"));
        return;
      }
      
      setLoading(true);
      
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert(t("Error"), t("You must be logged in"));
        return;
      }

      const zoneData = {
        name: zoneName,
        location: {
          address: "",
          latitude: null,
          longitude: null
        },
        image: profileImage
      };
      
      try {
        const response = await axios.post(
          API_ENDPOINTS.ZONES,
          zoneData,
          {
            headers: getAuthHeaders(token),
            timeout: API_TIMEOUT
          }
        );
        
        if (response.data && response.data.zone && response.data.zone._id) {
          await axios.post(
            `${API_ENDPOINTS.ZONES}/${response.data.zone._id}/switch`,
            {},
            {
              headers: getAuthHeaders(token),
              timeout: API_TIMEOUT
            }
          );
        }
        
        Alert.alert(
          t("Success"),
          t("Zone added successfully"),
          [
            { 
              text: t("OK"), 
              onPress: () => router.back() 
            }
          ]
        );
      } catch (apiError) {
        console.error("API Error:", apiError);
        
        if (apiError.response && apiError.response.data && apiError.response.data.message) {
          Alert.alert(t("Error"), t(apiError.response.data.message));
        } else {
          Alert.alert(t("Error"), t("Failed to save zone"));
        }
      }
    } catch (error) {
      console.error("Error saving zone:", error);
      Alert.alert(t("Error"), t("Failed to save zone"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Header with back button */}
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Title */}
        <Text style={styles.title}>Add Zone</Text>
        
        {/* Profile Image Section */}
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImage} />
          <TouchableOpacity onPress={handleChangeProfileImage}>
            <Text style={styles.changeProfileText}>Change Profile Location</Text>
          </TouchableOpacity>
        </View>

        {/* Zone Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={zoneName}
            onChangeText={setZoneName}
            placeholder=""
            placeholderTextColor="#999"
          />
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSaveZone}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    marginBottom: 30,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
    marginBottom: 15,
  },
  changeProfileText: {
    color: '#4285F4',
    fontSize: 16,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 8,
    fontSize: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  saveButton: {
    backgroundColor: '#4285F4',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});