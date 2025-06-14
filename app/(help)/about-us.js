import React from "react";
import { ScrollView, Text, View } from "react-native";
import tw from "twrnc";
import Support from "../components/Support";
import BackButton from "../components/BackButton";
export default function About() {
  return (
    <ScrollView
      style={tw`flex-1 bg-white`}
      contentContainerStyle={tw`flex-grow p-4`}
    >
      <BackButton />
      <View style={tw`px-6`}>
        <Text
          style={tw`text-xl text-gray-600 border-b border-gray-200 mb-4 text-center pb-4`}
        >
          About Us
        </Text>
        <Text style={tw`text-gray-700 mb-4`}>
          SmartIoT is an intelligent platform that allows users to monitor and
          manage environmental sensor data in real-time. We are committed to
          empowering farmers, and general users with tools to analyze and plan
          efficiently based on accurate data.
        </Text>

        <View style={tw`border border-gray-200 p-4 rounded-xl mb-6`}>
          <Text style={tw`mb-4`}>
            <Text>Developed by:</Text>{" "}
            <Text style={tw`text-gray-400`}>
              Thitaree, Panida, Prathana, Sorasak
            </Text>
          </Text>
          <Text style={tw`mb-4`}>
            <Text>Contact:</Text>
            <Text style={tw`text-gray-400`}> support@smartiot.com</Text>
          </Text>
          <Text style={tw`mb-4`}>
            <Text>Location:</Text>
            <Text style={tw`text-gray-400`}> Chiang Rai, Thailand</Text>
          </Text>
          <Text style={tw`mb-4`}>
            <Text>App Version: </Text>
            <Text style={tw`text-gray-400`}>
              {" "}
              1.2.3 (Last updated: June 2025)
            </Text>
          </Text>
        </View>
      </View>

      {/* Footer ติดล่างสุดของ ScrollView */}
      <Support />
    </ScrollView>
  );
}
