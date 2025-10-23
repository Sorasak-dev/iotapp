import { ScrollView, Text, StyleSheet, SafeAreaView, View, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';

const Header = ({ title, onBackPress }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
  </View>
);

const TermsOfServiceScreen = () => {
  const router = useRouter();
  const content = `
**มีผลบังคับใช้: 1 สิงหาคม 2568**

ข้อกำหนดนี้เป็นข้อตกลงทางกฎหมายระหว่างท่านและทีมผู้พัฒนาเกี่ยวกับการใช้งานแอปพลิเคชันของเรา

**1. บัญชีผู้ใช้**
ท่านมีหน้าที่รับผิดชอบในการรักษารหัสผ่านของท่านให้เป็นความลับ และกิจกรรมทั้งหมดที่เกิดขึ้นภายใต้บัญชีของท่าน

**2. การใช้งานบริการ**
ท่านตกลงที่จะไม่ใช้บริการเพื่อวัตถุประสงค์ที่ผิดกฎหมาย, ละเมิดสิทธิ์ของผู้อื่น, หรือพยายามเข้าถึงระบบของเราโดยไม่ได้รับอนุญาต

**3. ทรัพย์สินทางปัญญา**
บริการและเนื้อหาทั้งหมดเป็นทรัพย์สินของเราและได้รับการคุ้มครองตามกฎหมายลิขสิทธิ์ ท่านไม่สามารถคัดลอกหรือดัดแปลงส่วนหนึ่งส่วนใดโดยไม่ได้รับอนุญาต

**4. การจำกัดความรับผิด**
บริการนี้ให้บริการ "ตามที่เป็น" เราไม่รับประกันว่าบริการจะทำงานได้อย่างต่อเนื่องหรือปราศจากข้อผิดพลาด และไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้งานอุปกรณ์ IoT ของท่าน

**5. ติดต่อเรา**
หากมีคำถามเกี่ยวกับข้อกำหนดนี้ กรุณาติดต่อเราที่: [อีเมลติดต่อ]
  `;

  const renderContent = (text) => {
    return text.split('\n').map((line, index) => {
      if (line.trim().startsWith('**')) {
        return <Text key={index} style={styles.subHeader}>{line.replace(/\*\*/g, '').trim()}</Text>;
      }
      return <Text key={index} style={styles.paragraph}>{line.trim()}</Text>;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="ข้อกำหนดการให้บริการ" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
            {renderContent(content.trim())}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
  },
  subHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    marginBottom: 16,
  },
});

export default TermsOfServiceScreen;
