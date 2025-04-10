import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Svg, Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";

const EditProfileScreen = () => {
  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    name: "Sarah Wilson",
    username: "bok",
    email: "john.doe@email.com",
    phone: "66+ 9564444444",
    gender: "Female",
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

  const ProfileAvatar = () => (
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

  const handleSave = () => {
    console.log("Saving profile:", formData);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("settings")}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Edit Profile</Text>

        <View style={styles.profilePhotoSection}>
          <ProfileAvatar />
          <TouchableOpacity>
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
              <Text style={styles.genderText}>{formData.gender}</Text>
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
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
