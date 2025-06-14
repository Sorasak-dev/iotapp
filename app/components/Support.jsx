import React from "react";
import { Text, View } from "react-native";
import tw from "twrnc";
function Support() {
  return (
    <View style={tw`mt-auto px-1 pt-6 pb-10 `}>
      <Text style={tw`text-[#8FBAF3] text-center text-sm`}>
        พบปัญหาในการใช้งาน {"\n"}กรุณาติดต่อฝ่ายสนับสนุนของเราได้ที่{"\n"}
        Email : support@smartiot.com{"\n"}
        Tell : 000-000-0000
      </Text>
    </View>
  );
}

export default Support;
