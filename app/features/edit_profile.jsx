// D:\y3\งานจารออย\iotapp-2\app\features\edit_profile.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Svg, Circle, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { API_ENDPOINTS, getAuthHeaders } from "../utils/config/api";

const EditProfileScreen = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    gender: "",
  });
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'No authentication token found.' });
        return;
      }

      const response = await fetch(API_ENDPOINTS.USERS, {
        method: "GET",
        headers: getAuthHeaders(token),
      });
      
      const data = await response.json();
      if (response.ok) {
        setFormData({
          name: data.name || "",
          username: data.username || "",
          email: data.email || "",
          phone: data.phone || "",
          gender: data.gender || "",
        });
        setProfileImageUri(data.profileImageUrl || null);
      } else {
        Toast.show({ type: 'error', text1: 'Failed to load profile', text2: data.message || 'An error occurred.' });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Toast.show({ type: 'error', text1: 'Network Error', text2: 'Could not connect to the server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setProfileImageUri(localUri);
      Toast.show({ type: 'info', text1: 'Image selected', text2: 'Image is not yet uploaded to the server.' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${API_ENDPOINTS.USERS}/profile`, {
        method: "PATCH",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ ...formData, profileImageUrl: profileImageUri }),
      });

      const data = await response.json();
      if (response.ok) {
        Toast.show({ type: 'success', text1: 'Profile Saved', text2: 'Your profile has been updated successfully.' });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Save Failed', text2: data.message || 'An error occurred while saving.' });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Toast.show({ type: 'error', text1: 'Network Error', text2: 'Could not connect to the server.' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

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
  const ProfileAvatar = ({ uri }) => (
    uri ? (
      <Image source={{ uri }} style={styles.profileImage} />
    ) : (
      <Svg width="80" height="80" viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="40" fill="#E8EEFF" />
        <Circle cx="40" cy="34" r="16" fill="#FF4D6A" />
        <Path
          d="M40 80c16.2 0 29.333-13.133 29.333-29.333 0-12.467-7.76-23.067-18.666-27.293A29.333 29.333 0 0 1 40 80z"
          fill="#FF99AA"
          fillOpacity="0.5"
        />
        <Path
          d="M26.667 28.667C26.667 28.667 33.333 40 40 40c6.667 0 13.333-11.333 13.333-11.333"
          stroke="#FFF"
          strokeWidth="2.667"
          fill="none"
        />
        <Circle cx="32" cy="26" r="2.667" fill="#FFF" />
        <Circle cx="48" cy="26" r="2.667" fill="#FFF" />
        <Path d="M20 20 Q 26.667 6.667 33.333 20 L 26.667 20 Z" fill="#FFE0E6" />
        <Path d="M46.667 20 Q 53.333 6.667 60 20 L 53.333 20 Z" fill="#FFE0E6" />
      </Svg>
    )
  );
  const InputField = ({ label, value, onChangeText, placeholder }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Edit Profile</Text>

        <View style={styles.profilePhotoSection}>
          <ProfileAvatar uri={profileImageUri} />
          <TouchableOpacity onPress={handleImagePick}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <InputField
            label="Name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter your name"
          />
          <InputField
            label="Username"
            value={formData.username}
            onChangeText={(text) =>
              setFormData({ ...formData, username: text })
            }
            placeholder="Enter username"
          />
          <InputField
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="Enter email"
            editable={false}
          />
          <InputField
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Enter phone number"
          />
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity style={styles.genderSelector}>
              <Text style={styles.genderText}>{formData.gender || 'Select Gender'}</Text>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 9l6 6 6-6"
                  stroke="#999"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 16,
    marginBottom: 14,
  },
  profilePhotoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  changePhotoText: {
    color: "#2D7CFF",
    fontSize: 16,
    marginTop: 12,
  },
  formContainer: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: "#666",
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 8,
    fontSize: 16,
  },
  genderSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 8,
  },
  genderText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#2D7CFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
    marginBottom: 16,
    width: 300,
    alignSelf: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default EditProfileScreen;
