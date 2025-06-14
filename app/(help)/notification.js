import BackButton from "../components/BackButton";
import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
import tw from "twrnc";
import Support from "../components/Support";
export default function notification() {
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

        <Text style={tw`text-gray-600 mb-4 px-3`}>
          {"    "}
          Get real-time alerts when data exceeds set thresholds or when unusual
          conditions are detected so you never miss a critical event
        </Text>
        <Text style={tw` mb-3 px-3`}>Select Notification Format</Text>
        <View
          style={tw`grid grid-cols-1 p-3 border border-gray-200 rounded-xl`}
        >
          <Text style={tw`mb-3 text-gray-700`}>
            Select Notification Format {"\n"}In App: Push Notification
          </Text>
          <Text style={tw`mb-3 text-gray-700`}>
            Phone: Link Account, Phone Number to the{"\n"}system to receive
            instant messages
          </Text>
          <Text style={tw`mb-3 text-gray-700`}>
            Email: Receive daily or instant email reports {"\n"}and summaries
            whem am event occurs
          </Text>
        </View>
        <Text style={tw`mt-10 text-gray-700 px-3`}>Clearing notifications</Text>
        <View
          style={tw`grid grid-cols-1 p-3 border border-gray-200 rounded-xl`}
        >
          <Text style={tw`mb-5 text-gray-700`}>
            1. Select to delete only some items by clicking the checkbox and
            selecting the delete menu.
          </Text>
          <Text style={tw`mb-5 text-gray-700`}>
            2. Delete all at once by clicking the “Delete all” button from the
            three-dot menu.
          </Text>
          <Text style={tw`text-gray-700`}>
            3. Filter alert types to see only important ones, such as data
            errors or low battery
          </Text>

          <Image
            source={require("../assets/images/4select.png")}
            style={tw`w-full h-70 rounded-md mb-4 mt-10`}
            resizeMode="contain"
          />
        </View>
      </View>
      <Support />
    </ScrollView>
  );
}
