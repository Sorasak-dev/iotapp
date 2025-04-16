import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Svg, Circle, Path } from "react-native-svg";

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

const ForgetPasswordScreen = ({ navigation }) => {
  const navigationPart = useNavigation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigationPart.navigate("change_password")}
        >
          <BackIcon />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerTitle}>Forget Password</Text>
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="bok"
            placeholderTextColor="#000"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="john.doe@email.com"
            placeholderTextColor="#000"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    marginLeft: 20,
    marginRight: 20,
    marginTop: 14,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: "#000",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    marginLeft: 24,
    marginRight: 24,
    color: "#000",
    marginBottom: 30,
  },
  form: {
    paddingHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 24,
    marginLeft: 30,
    marginRight: 30,
  },
  label: {
    fontSize: 14,
    color: "#9e9e9e",
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 8,
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: "#2196F3",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
    width: "50%",
    alignSelf: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default ForgetPasswordScreen;