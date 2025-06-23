import React from "react";
import { Image, ScrollView, Text, View, Dimensions, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import tw from "twrnc";
import Support from "../components/Support";
import BackButton from "../components/BackButton";

const { width, height } = Dimensions.get('window');

const NotificationScreen = () => {
  const router = useRouter();
  
  const isSmallScreen = width < 375;
  const isMediumScreen = width >= 375 && width < 414;
  const isLargeScreen = width >= 414;
  
  const horizontalPadding = isSmallScreen ? 'px-4' : isMediumScreen ? 'px-6' : 'px-8';
  const contentPadding = isSmallScreen ? 'p-3' : 'p-4';

  return (
    <SafeAreaView style={tw`flex-1 bg-white`}>
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`flex-grow pb-6`}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Back Button and Title */}
        <View style={tw`${horizontalPadding} pt-4 pb-6`}>
          <View style={tw`flex-row items-center justify-between relative`}>
            {/* Back Button */}
            <BackButton />
            
            {/* Title - Centered using absolute positioning */}
            <View style={tw`absolute left-0 right-0 items-center`}>
              <Text style={tw`text-xl font-medium text-gray-600`}>
                Notification
              </Text>
            </View>
            
            {/* Empty View for balance */}
            <View style={tw`w-6`} />
          </View>
          
          {/* Separator line */}
          <View style={tw`border-b border-gray-200 mt-4`} />
        </View>

        {/* Main Content */}
        <View style={tw`${horizontalPadding} flex-1`}>
          {/* Description */}
          <Text style={tw`text-gray-600 mb-6 text-base leading-6`}>
            Get real-time alerts when data exceeds set thresholds or when unusual
            conditions are detected so you never miss a critical event
          </Text>

          {/* Select Notification Format Section */}
          <Text style={tw`text-gray-900 font-medium mb-3 text-base`}>
            Select Notification Format
          </Text>
          
          <View style={tw`border border-gray-200 ${contentPadding} rounded-xl mb-6`}>
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-900 font-medium mb-1`}>In App:</Text>
              <Text style={tw`text-gray-700 text-sm`}>Push Notification</Text>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-900 font-medium mb-1`}>Phone:</Text>
              <Text style={tw`text-gray-700 text-sm leading-5`}>
                Link Account, Phone Number to the system to receive instant messages
              </Text>
            </View>
            
            <View>
              <Text style={tw`text-gray-900 font-medium mb-1`}>Email:</Text>
              <Text style={tw`text-gray-700 text-sm leading-5`}>
                Receive daily or instant email reports and summaries when an event occurs
              </Text>
            </View>
          </View>

          {/* Clearing Notifications Section */}
          <Text style={tw`text-gray-900 font-medium mb-3 text-base`}>
            Clearing Notifications
          </Text>
          
          <View style={tw`border border-gray-200 ${contentPadding} rounded-xl mb-6`}>
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-700 text-sm leading-5`}>
                <Text style={tw`font-medium`}>1.</Text> Select to delete only some items by clicking the checkbox and selecting the delete menu.
              </Text>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-700 text-sm leading-5`}>
                <Text style={tw`font-medium`}>2.</Text> Delete all at once by clicking the "Delete all" button from the three-dot menu.
              </Text>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-700 text-sm leading-5`}>
                <Text style={tw`font-medium`}>3.</Text> Filter alert types to see only important ones, such as data errors or low battery.
              </Text>
            </View>

            {/* Image */}
            <View style={tw`mt-4`}>
              <Image
                source={require("../assets/images/4select.png")}
                style={tw`w-full h-64 rounded-lg`}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Support Component */}
          <Support />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationScreen;