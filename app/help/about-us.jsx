import { ScrollView, Text, View, SafeAreaView, Dimensions } from "react-native";
import tw from "twrnc";
import Support from "../components/Support";
import BackButton from "../components/BackButton";

const { width, height } = Dimensions.get('window');

export default function About() {
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
                About Us
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
          <Text style={tw`text-gray-700 leading-6 mb-6 text-base`}>
            SmartIoT is an intelligent platform that allows users to monitor and
            manage environmental sensor data in real-time. We are committed to
            empowering farmers, and general users with tools to analyze and plan
            efficiently based on accurate data.
          </Text>

          {/* Info Card */}
          <View style={tw`border border-gray-200 ${contentPadding} rounded-xl mb-6`}>
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-900 font-medium mb-1`}>Developed by:</Text>
              <Text style={tw`text-gray-400 text-sm leading-5`}>
                Thitaree, Panida, Prathana, Sorasak
              </Text>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-900 font-medium mb-1`}>Contact:</Text>
              <Text style={tw`text-gray-400 text-sm`}>support@smartiot.com</Text>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-900 font-medium mb-1`}>Location:</Text>
              <Text style={tw`text-gray-400 text-sm`}>Chiang Rai, Thailand</Text>
            </View>
            
            <View>
              <Text style={tw`text-gray-900 font-medium mb-1`}>App Version:</Text>
              <Text style={tw`text-gray-400 text-sm`}>
                1.2.3 (Last updated: June 2025)
              </Text>
            </View>
          </View>

          {/* Spacer for smaller screens */}
          {isSmallScreen && <View style={tw`h-4`} />}

          {/* Support Component */}
          <Support />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}