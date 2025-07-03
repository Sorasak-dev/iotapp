import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import os

class SensorDataGenerator:
    def __init__(self):
        # ข้อมูลอุปกรณ์ตาม server.js ของคุณ
        self.device_templates = [
            {"id": "1", "name": "E-MIB1", "type": "Temperature & Humidity Sensor"},
            {"id": "2", "name": "E-MIB2", "type": "Temperature & Humidity Sensor"},
            {"id": "3", "name": "E-MIB3", "type": "Temperature & Humidity Sensor"},
            {"id": "4", "name": "E-MIB4", "type": "Temperature & Humidity Sensor"}
        ]
    
    def generate_normal_sensor_data(self, device_id, start_date, end_date, interval_minutes=10):
        """สร้างข้อมูลเซ็นเซอร์ปกติ (เหมือนใน server.js)"""
        print(f"🔄 สร้างข้อมูลปกติสำหรับ device {device_id}...")
        
        data = []
        current_time = start_date
        device_variation = int(device_id) if device_id.isdigit() else 1
        
        while current_time <= end_date:
            # สร้างค่าเซ็นเซอร์ตาม server.js
            temperature = round(random.uniform(20, 40), 2)
            humidity = round(random.uniform(30, 80) + device_variation, 2)
            co2 = int(random.uniform(200, 1000) + (device_variation * 50))
            ec = round(random.uniform(0.5, 2.0) + (device_variation * 0.1), 2)
            ph = round(random.uniform(4, 9) + (device_variation * 0.2), 2)
            
            # คำนวณ dew point และ VPD (เหมือนใน server.js)
            a, b = 17.27, 237.7
            alpha = ((a * temperature) / (b + temperature)) + np.log(humidity / 100)
            dew_point = round((b * alpha) / (a - alpha), 2)
            
            saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temperature) / (temperature + 237.3))
            actual_vapor_pressure = saturation_vapor_pressure * (humidity / 100)
            vpd = round(saturation_vapor_pressure - actual_vapor_pressure, 2)
            
            # Voltage และ battery (ปกติ)
            voltage = round(random.uniform(3.2, 3.4), 2)
            battery_level = random.randint(80, 100)
            
            data.append({
                'device_id': device_id,
                'timestamp': current_time.isoformat(),
                'temperature': temperature,
                'humidity': humidity,
                'co2': co2,
                'ec': ec,
                'ph': ph,
                'dew_point': dew_point,
                'vpd': vpd,
                'voltage': voltage,
                'battery_level': battery_level,
                'anomaly_type': 'normal',
                'is_anomaly': 0
            })
            
            current_time += timedelta(minutes=interval_minutes)
        
        return data
    
    def generate_anomaly_data(self, device_id, start_date, end_date, anomaly_types, interval_minutes=10):
        """สร้างข้อมูลผิดปกติ"""
        print(f"⚠️ สร้างข้อมูลผิดปกติสำหรับ device {device_id}...")
        
        data = []
        current_time = start_date
        
        while current_time <= end_date:
            anomaly_type = random.choice(anomaly_types)
            
            # สร้างข้อมูลตามประเภทความผิดปกติ
            if anomaly_type == "sudden_drop":
                temperature = round(random.uniform(15, 25), 2)
                humidity = round(random.uniform(30, 80), 2)
                voltage = round(random.uniform(2.5, 2.8), 2)  # Voltage ต่ำ
                
            elif anomaly_type == "sudden_spike":
                temperature = round(random.uniform(45, 55), 2)
                humidity = round(random.uniform(30, 80), 2)
                voltage = round(random.uniform(3.6, 4.0), 2)  # Voltage สูง
                
            elif anomaly_type == "vpd_too_low":
                temperature = round(random.uniform(20, 25), 2)
                humidity = round(random.uniform(90, 98), 2)  # ความชื้นสูงมาก
                voltage = round(random.uniform(3.2, 3.4), 2)
                
            elif anomaly_type == "low_voltage":
                temperature = round(random.uniform(20, 40), 2)
                humidity = round(random.uniform(30, 80), 2)
                voltage = round(random.uniform(2.0, 2.7), 2)  # Voltage ต่ำมาก
                
            else:  # ค่าเริ่มต้น
                temperature = round(random.uniform(20, 40), 2)
                humidity = round(random.uniform(30, 80), 2)
                voltage = round(random.uniform(3.2, 3.4), 2)
            
            # คำนวณค่าอื่นๆ
            co2 = int(random.uniform(200, 1000))
            ec = round(random.uniform(0.5, 2.0), 2)
            ph = round(random.uniform(4, 9), 2)
            
            # คำนวณ dew point และ VPD
            a, b = 17.27, 237.7
            alpha = ((a * temperature) / (b + temperature)) + np.log(humidity / 100)
            dew_point = round((b * alpha) / (a - alpha), 2)
            
            saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temperature) / (temperature + 237.3))
            actual_vapor_pressure = saturation_vapor_pressure * (humidity / 100)
            vpd = round(saturation_vapor_pressure - actual_vapor_pressure, 2)
            
            battery_level = random.randint(10, 30) if anomaly_type == "low_voltage" else random.randint(50, 100)
            
            data.append({
                'device_id': device_id,
                'timestamp': current_time.isoformat(),
                'temperature': temperature,
                'humidity': humidity,
                'co2': co2,
                'ec': ec,
                'ph': ph,
                'dew_point': dew_point,
                'vpd': vpd,
                'voltage': voltage,
                'battery_level': battery_level,
                'anomaly_type': anomaly_type,
                'is_anomaly': 1
            })
            
            current_time += timedelta(minutes=interval_minutes)
        
        return data
    
    def generate_training_dataset(self, days=30, normal_ratio=0.8):
        """สร้างข้อมูลสำหรับเทรนโมเดล"""
        print(f"📊 สร้างข้อมูลเทรนนิ่ง {days} วัน...")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        all_data = []
        
        # ประเภทความผิดปกติ
        anomaly_types = [
            "sudden_drop", "sudden_spike", "vpd_too_low", "low_voltage"
        ]
        
        for device in self.device_templates:
            device_id = device["id"]
            print(f"📱 ประมวลผล {device['name']}...")
            
            # คำนวณจำนวนข้อมูล
            total_points = int(days * 24 * 6)  # 6 จุดต่อชั่วโมง (ทุก 10 นาที)
            normal_points = int(total_points * normal_ratio)
            anomaly_points = total_points - normal_points
            
            # สร้างข้อมูลปกติ
            normal_duration = timedelta(minutes=normal_points * 10)
            normal_end = start_date + normal_duration
            normal_data = self.generate_normal_sensor_data(
                device_id, start_date, normal_end, interval_minutes=10
            )
            
            # สร้างข้อมูลผิดปกติ
            if anomaly_points > 0:
                anomaly_start = normal_end + timedelta(minutes=10)
                anomaly_duration = timedelta(minutes=anomaly_points * 10)
                anomaly_end = anomaly_start + anomaly_duration
                anomaly_data = self.generate_anomaly_data(
                    device_id, anomaly_start, anomaly_end, anomaly_types, interval_minutes=10
                )
                all_data.extend(anomaly_data)
            
            all_data.extend(normal_data)
        
        # สร้าง DataFrame และสับข้อมูล
        df = pd.DataFrame(all_data)
        df = df.sample(frac=1).reset_index(drop=True)  # สับข้อมูล
        
        print(f"✅ สร้างข้อมูลเสร็จสิ้น: {len(df)} รายการ")
        return df
    
    def save_dataset(self, df, filename="sensor_training_data.csv"):
        """บันทึกข้อมูลลงไฟล์"""
        # สร้างโฟลเดอร์ data ถ้ายังไม่มี
        os.makedirs("data", exist_ok=True)
        
        filepath = f"data/{filename}"
        df.to_csv(filepath, index=False)
        print(f"💾 บันทึกข้อมูลลงไฟล์ {filepath}")
        
        # แสดงสถิติ
        print(f"📊 ข้อมูลปกติ: {len(df[df['is_anomaly'] == 0])} รายการ")
        print(f"⚠️ ข้อมูลผิดปกติ: {len(df[df['is_anomaly'] == 1])} รายการ")
        print(f"📈 อัตราส่วนข้อมูลผิดปกติ: {len(df[df['is_anomaly'] == 1]) / len(df) * 100:.2f}%")
        
        return df

# ทดสอบการทำงาน
if __name__ == "__main__":
    print("🚀 ทดสอบการสร้างข้อมูล...")
    
    # สร้างตัวสร้างข้อมูล
    generator = SensorDataGenerator()
    
    # สร้างข้อมูลทดสอบ (7 วัน)
    df = generator.generate_training_dataset(days=7, normal_ratio=0.75)
    
    # บันทึกข้อมูล
    generator.save_dataset(df, "test_sensor_data.csv")
    
    print("\n✅ ทดสอบเสร็จสิ้น!")
    print("📁 ไฟล์ที่สร้าง: data/test_sensor_data.csv")
    print("\n🔎 ตัวอย่างข้อมูล:")
    print(df.head())