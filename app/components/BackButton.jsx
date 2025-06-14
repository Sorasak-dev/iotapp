import React from "react";
import { TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import tw from "twrnc";
import { Ionicons } from "@expo/vector-icons";

export default function BackButton() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={tw`flex-row justify-center w-10 h-10 items-center`}
      onPress={() => navigation.goBack()}
    >
      <Ionicons name="arrow-back" size={24} color="black" />
    </TouchableOpacity>
  );
}
