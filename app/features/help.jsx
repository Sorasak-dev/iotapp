import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";

const HelpCenterScreen = () => {
  const router = useRouter();

  // CHANGE 1: แก้ไขให้รับ onPress prop และนำไปใช้กับ TouchableOpacity
  const PopularTopicItem = ({ title, onPress }) => (
    <TouchableOpacity style={styles.topicItem} onPress={onPress}>
      <Text style={styles.topicText}>{title}</Text>
      <Text style={styles.chevron}>{">"}</Text>
    </TouchableOpacity>
  );

  const FAQItem = ({ question, answer }) => (
    <View style={styles.faqItem}>
      <Text style={styles.faqQuestion}>{question}</Text>
      <Text style={styles.faqAnswer}>{answer}</Text>
    </View>
  );

  const popularTopics = useMemo(() => [
    { id: 1, title: "About us", path: "/about-us" }, // path สำหรับนำทาง
    { id: 2, title: "How to connect your sensor", path: "/connect-sensor" },
    { id: 3, title: "Notification", path: "/notification" },
    { id: 4, title: "Manage your zones", path: "/manage-zones" },
    { id: 5, title: "Statistics", path: "/statistics" },
    { id: 6, title: "Device Monitor", path: "/device-monitor" },
  ], []);

  const faqs = useMemo(() => [
    {
      id: 1,
      question: "How accurate are the temperature readings?",
      answer: "Our sensors provide accuracy within ±0.3°C for temperature measurements."
    },
    {
      id: 2,
      question: "How often should I calibrate my sensor?",
      answer: "We recommend calibrating your sensor every 6 months for optimal performance."
    },
    {
      id: 3,
      question: "What's the battery life of the sensor?",
      answer: "The sensor typically lasts 12-18 months on a single battery with normal use."
    }
  ], []);

  const supportOptions = useMemo(() => [
    {
      id: 1,
      iconType: "chat",
      title: "Chat with Support",
      subtitle: "Available 24/7",
      path: "/features/chat"
    },
    {
      id: 2,
      iconType: "email",
      title: "Email Support",
      subtitle: "Response within 24h",
      path: "email_support"
    },
    {
      id: 3,
      iconType: "phone",
      title: "Call Support",
      subtitle: "Mon-Fri 9AM-6PM",
      path: "phone_support"
    }
  ], []);

  const getIcon = (iconType) => {
    const iconProps = {
      width: "33",
      height: "33",
      viewBox: "0 0 33 33",
      fill: "none"
    };

    switch (iconType) {
      case "chat":
        return (
          <Svg {...iconProps}>
            <Path
              d="M5.67188 8.42188L16.5 15.3828L28.1016 8.42188M7.21875 25.1685C5.51012 25.1685 4.125 23.7834 4.125 22.0747V9.96875C4.125 8.26012 5.51012 6.875 7.21875 6.875H25.7812C27.4899 6.875 28.875 8.26012 28.875 9.96875V22.0747C28.875 23.7834 27.4899 25.1685 25.7812 25.1685H7.21875Z"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case "email":
        return (
          <Svg {...iconProps}>
            <Path
              d="M4.125 8.25L16.5 16.5L28.875 8.25M4.125 24.75H28.875V8.25H4.125V24.75Z"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case "phone":
        return (
          <Svg {...iconProps}>
            <Path
              d="M8.25 4.125H12.375L15.5625 12.375L11.4375 15.5625C12.8438 18.5938 15.6562 21.4062 18.5625 22.8125L21.75 18.6875L30 21.875V26H26.8125C14.2188 26 4.125 15.9062 4.125 8.25V4.125Z"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      default:
        return null;
    }
  };

  const SupportItem = ({ iconType, title, subtitle, path }) => (
    <TouchableOpacity
      style={styles.supportItem}
      onPress={() => path && router.push(path)}
    >
      {getIcon(iconType)}
      <View style={styles.supportContent}>
        <Text style={styles.supportTitle}>{title}</Text>
        <Text style={styles.supportSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>{">"}</Text>
    </TouchableOpacity>
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/tabs/settings');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Topics</Text>
          {/* CHANGE 2: ส่ง onPress prop ที่จะเรียก router.push เข้าไป */}
          {popularTopics.map(topic => (
            <PopularTopicItem 
              key={topic.id} 
              title={topic.title} 
              onPress={() => topic.path && router.push(topic.path)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map(faq => (
            <FAQItem 
              key={faq.id} 
              question={faq.question} 
              answer={faq.answer} 
            />
          ))}
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Need More Help?</Text>
          {supportOptions.map(option => (
            <SupportItem
              key={option.id}
              iconType={option.iconType}
              title={option.title}
              subtitle={option.subtitle}
              path={option.path}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    fontWeight: "600",
    marginLeft: 16,
    color: "#000",
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  lastSection: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    color: "#000",
  },
  topicItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  topicText: {
    fontSize: 15,
    color: "#000",
  },
  chevron: {
    fontSize: 15,
    color: "#999",
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 15,
    color: "#000",
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  supportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  supportIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  supportContent: {
    flex: 1,
    marginLeft: 14,
  },
  supportTitle: {
    fontSize: 15,
    color: "#000",
  },
  supportSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});

export default HelpCenterScreen;