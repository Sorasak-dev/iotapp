import BackButton from "../components/BackButton";
import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
import tw from "twrnc";
import Support from "../components/Support";

export default function connectSensor() {
  return (
    <ScrollView
      style={tw`flex-1 bg-white`}
      contentContainerStyle={tw`flex-grow p-4`}
    >
      <BackButton />
      <View style={tw`px-6 grid grid-cols-2 gap-4`}>
        <Text
          style={tw`text-xl text-gray-600 border-b border-gray-200 mb-4 text-center pb-4`}
        >
          How to Connect Your Sensor
        </Text>
        <View>
          <Text style={tw`text-gray-700 mb-4 font-bold`}>
            1.select “+” or select “Add device”
          </Text>
          <View style={tw`p-4 border border-gray-200 rounded-xl`}>
            <Image
              source={require("../assets/images/1select.png")}
              style={tw`w-full h-50 rounded-md mb-4`}
              resizeMode="contain"
            />
          </View>
        </View>
        <View>
          <Text style={tw`text-gray-700 mb-4 font-bold`}>
            2.Select device that you want to connect.
          </Text>
          <View style={tw`p-4 border border-gray-200 rounded-xl`}>
            <Image
              source={require("../assets/images/2_select.png")}
              style={tw`w-full h-50 rounded-md mb-4`}
              resizeMode="contain"
            />
          </View>
        </View>
        <View>
          <Text style={tw`text-gray-700 mb-4 font-bold`}>
            3.Add other device
          </Text>
          <View style={tw`p-4 border border-gray-200 rounded-xl`}>
            <Image
              source={require("../assets/images/select3.png")}
              style={tw`w-full h-30 rounded-md mb-4`}
              resizeMode="contain"
            />
          </View>
        </View>
        <View>
          <Text style={tw`text-gray-700 mb-4 font-bold`}>
            3.Add other device
          </Text>
          <View style={tw`p-4 border border-gray-200 rounded-xl`}>
            <Image
              source={require("../assets/images/3select.png")}
              style={tw`w-full h-50 rounded-md mb-4`}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
      <Support />
    </ScrollView>
  );
}
