import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from anomaly_models import AnomalyDetectionModels, RuleBasedAnomalyDetector
import warnings
warnings.filterwarnings('ignore')

class AnomalyDetectionAPI:
    """API สำหรับการใช้งานโมเดล Anomaly Detection"""
    
    def __init__(self, models_path="models/anomaly_detection"):
        self.models_path = models_path
        self.ml_detector = AnomalyDetectionModels()
        self.rule_detector = RuleBasedAnomalyDetector()
        self.feature_columns = [
            'temperature', 'humidity', 'co2', 'ec', 'ph', 
            'dew_point', 'vpd', 'voltage', 'battery_level'
        ]
        self.time_features = ['hour', 'day_of_week', 'month']
        
        # โหลดโมเดล
        self.load_models()
    
    def load_models(self):
        """โหลดโมเดลที่เทรนแล้ว"""
        try:
            self.ml_detector.load_models(self.models_path)
            print("✅ โหลดโมเดล ML สำเร็จ")
        except Exception as e:
            print(f"⚠️ ไม่สามารถโหลดโมเดล ML: {e}")
            print("💡 รันคำสั่ง: python train_models.py เพื่อสร้างโมเดล")
    
    def preprocess_sensor_data(self, sensor_data):
        """เตรียมข้อมูลเซ็นเซอร์สำหรับการทำนาย"""
        if isinstance(sensor_data, dict):
            sensor_data = [sensor_data]
        
        df = pd.DataFrame(sensor_data)
        
        # แปลง timestamp
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df['hour'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['month'] = df['timestamp'].dt.month
        else:
            # ใช้เวลาปัจจุบัน
            now = datetime.now()
            df['hour'] = now.hour
            df['day_of_week'] = now.weekday()
            df['month'] = now.month
        
        # สร้าง missing indicators
        for col in self.feature_columns:
            df[f'{col}_is_missing'] = df[col].isnull().astype(int)
        
        # เติมค่า null ด้วยค่าเฉลี่ย (สำหรับการทำนาย)
        for col in self.feature_columns:
            if col in df.columns:
                df[col] = df[col].fillna(df[col].mean() if not df[col].isnull().all() else 0)
        
        # เลือก features ที่ต้องการ
        missing_cols = [f'{col}_is_missing' for col in self.feature_columns]
        all_features = self.feature_columns + self.time_features + missing_cols
        
        # สร้างคอลัมน์ที่ไม่มีและเติมค่า 0
        for feature in all_features:
            if feature not in df.columns:
                df[feature] = 0
        
        return df[all_features].values
    
    def detect_anomalies_ml(self, sensor_data, model_name='ensemble'):
        """ตรวจจับความผิดปกติด้วยโมเดล ML"""
        try:
            X = self.preprocess_sensor_data(sensor_data)
            predictions = self.ml_detector.predict_anomalies(X, model_name)
            
            results = []
            for i, pred in enumerate(predictions):
                results.append({
                    'is_anomaly': bool(pred),
                    'confidence': float(pred),
                    'model_used': model_name,
                    'timestamp': datetime.now().isoformat()
                })
            
            return results
            
        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาดในการตรวจจับด้วย ML: {e}")
            return [{'is_anomaly': False, 'error': str(e)}]
    
    def detect_anomalies_rules(self, sensor_data, data_history=None):
        """ตรวจจับความผิดปกติด้วยกฎที่กำหนด"""
        try:
            anomalies = self.rule_detector.detect_anomalies(sensor_data)
            
            results = []
            for anomaly in anomalies:
                results.append({
                    'is_anomaly': True,
                    'anomaly_type': anomaly['type'],
                    'alert_level': anomaly['alert_level'],
                    'message': anomaly['message'],
                    'timestamp': anomaly['timestamp'],
                    'detection_method': 'rule_based'
                })
            
            # ถ้าไม่พบความผิดปกติ
            if not results:
                results.append({
                    'is_anomaly': False,
                    'message': 'Sensor operating normally',
                    'detection_method': 'rule_based',
                    'timestamp': datetime.now().isoformat()
                })
            
            return results
            
        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาดในการตรวจจับด้วยกฎ: {e}")
            return [{'is_anomaly': False, 'error': str(e)}]
    
    def detect_anomalies_hybrid(self, sensor_data, data_history=None, ml_model='ensemble'):
        """ตรวจจับความผิดปกติแบบผสมผสาน (ML + Rules)"""
        
        # ตรวจจับด้วยกฎ
        rule_results = self.detect_anomalies_rules(sensor_data, data_history)
        
        # ตรวจจับด้วย ML
        ml_results = self.detect_anomalies_ml(sensor_data, ml_model)
        
        # รวมผลลัพธ์
        combined_results = {
            'rule_based_detection': rule_results,
            'ml_detection': ml_results,
            'summary': {
                'rule_anomalies_found': any(r.get('is_anomaly', False) for r in rule_results),
                'ml_anomalies_found': any(r.get('is_anomaly', False) for r in ml_results),
                'total_anomalies': 0,
                'alert_level': 'green',
                'recommendations': []
            }
        }
        
        # กำหนด alert level และคำแนะนำ
        rule_anomalies = [r for r in rule_results if r.get('is_anomaly', False)]
        ml_anomalies = [r for r in ml_results if r.get('is_anomaly', False)]
        
        combined_results['summary']['total_anomalies'] = len(rule_anomalies) + len(ml_anomalies)
        
        # กำหนด alert level ตาม rule-based (เพราะมีความเฉพาะเจาะจงมากกว่า)
        if rule_anomalies:
            alert_levels = [r.get('alert_level', 'yellow') for r in rule_anomalies]
            if 'red' in alert_levels:
                combined_results['summary']['alert_level'] = 'red'
            elif 'yellow' in alert_levels:
                combined_results['summary']['alert_level'] = 'yellow'
        elif ml_anomalies:
            combined_results['summary']['alert_level'] = 'yellow'  # ML ให้ yellow เป็นค่าเริ่มต้น
        
        # สร้างคำแนะนำ
        recommendations = []
        for anomaly in rule_anomalies:
            recommendations.append({
                'type': anomaly.get('anomaly_type', 'unknown'),
                'message': anomaly.get('message', ''),
                'priority': 'high' if anomaly.get('alert_level') == 'red' else 'medium'
            })
        
        if ml_anomalies and not rule_anomalies:
            recommendations.append({
                'type': 'general_anomaly',
                'message': 'Machine learning model detected unusual patterns. Please investigate.',
                'priority': 'medium'
            })
        
        combined_results['summary']['recommendations'] = recommendations
        combined_results['timestamp'] = datetime.now().isoformat()
        
        return combined_results
    
    def generate_alert_message(self, anomaly_results):
        """สร้างข้อความแจ้งเตือนที่อ่านง่าย"""
        if not anomaly_results.get('summary', {}).get('rule_anomalies_found') and \
           not anomaly_results.get('summary', {}).get('ml_anomalies_found'):
            return {
                'level': 'info',
                'title': 'System Normal',
                'message': 'All sensors are operating within normal parameters.',
                'icon': '✅'
            }
        
        alert_level = anomaly_results.get('summary', {}).get('alert_level', 'yellow')
        recommendations = anomaly_results.get('summary', {}).get('recommendations', [])
        
        # กำหนดไอคอนและระดับความสำคัญ
        icons = {'red': '🔴', 'yellow': '⚠️', 'green': '✅'}
        levels = {'red': 'critical', 'yellow': 'warning', 'green': 'info'}
        
        icon = icons.get(alert_level, '⚠️')
        level = levels.get(alert_level, 'warning')
        
        # สร้างข้อความหลัก
        if alert_level == 'red':
            title = 'Critical System Alert'
            message = 'Immediate attention required! Critical anomalies detected in sensor data.'
        elif alert_level == 'yellow':
            title = 'System Warning'
            message = 'Unusual patterns detected. Please investigate when possible.'
        else:
            title = 'System Information'
            message = 'Minor variations detected in sensor readings.'
        
        # เพิ่มรายละเอียดจากคำแนะนำ
        if recommendations:
            details = []
            for rec in recommendations:
                details.append(f"• {rec.get('message', 'Unknown issue')}")
            message += f"\n\nDetails:\n" + "\n".join(details)
        
        return {
            'level': level,
            'title': title,
            'message': message,
            'icon': icon,
            'timestamp': datetime.now().isoformat(),
            'recommendations': recommendations
        }

class SensorSimulator:
    """คลาสสำหรับจำลองข้อมูลเซ็นเซอร์เพื่อทดสอบ"""
    
    def __init__(self):
        self.current_values = {
            'temperature': 25.0,
            'humidity': 60.0,
            'co2': 400,
            'ec': 1.2,
            'ph': 6.5,
            'voltage': 3.3,
            'battery_level': 85
        }
    
    def generate_normal_data(self):
        """สร้างข้อมูลปกติ"""
        # เพิ่มสัญญาณรบกวนเล็กน้อย
        data = {}
        for key, value in self.current_values.items():
            if key in ['temperature', 'humidity']:
                noise = np.random.normal(0, 0.5)
            elif key == 'voltage':
                noise = np.random.normal(0, 0.05)
            elif key == 'battery_level':
                noise = np.random.normal(0, 1)
            else:
                noise = np.random.normal(0, value * 0.02)
            
            data[key] = value + noise
        
        # คำนวณ dew point และ VPD
        temp = data['temperature']
        humidity = data['humidity']
        
        a, b = 17.27, 237.7
        alpha = ((a * temp) / (b + temp)) + np.log(humidity / 100)
        dew_point = (b * alpha) / (a - alpha)
        
        saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
        actual_vapor_pressure = saturation_vapor_pressure * (humidity / 100)
        vpd = saturation_vapor_pressure - actual_vapor_pressure
        
        data['dew_point'] = round(dew_point, 2)
        data['vpd'] = round(vpd, 2)
        data['timestamp'] = datetime.now().isoformat()
        
        return data
    
    def generate_anomaly_data(self, anomaly_type):
        """สร้างข้อมูลผิดปกติตามประเภทที่กำหนด"""
        data = self.generate_normal_data()
        
        if anomaly_type == 'sudden_drop':
            data['temperature'] = 15.0  # อุณหภูมิลดลงมาก
            data['voltage'] = 2.5       # voltage ต่ำ
            
        elif anomaly_type == 'sudden_spike':
            data['temperature'] = 50.0  # อุณหภูมิสูงมาก
            data['voltage'] = 3.8       # voltage สูง
            
        elif anomaly_type == 'low_voltage':
            data['voltage'] = 2.0       # voltage ต่ำมาก
            data['battery_level'] = 15  # แบตต่ำ
            
        elif anomaly_type == 'vpd_too_low':
            data['humidity'] = 95       # ความชื้นสูงมาก
            data['temperature'] = 22    # อุณหภูมิค่อนข้างต่ำ
            
        elif anomaly_type == 'dew_point_close':
            data['humidity'] = 98       # ความชื้นสูงมาก
            data['temperature'] = 25
            # คำนวณ dew point ใหม่
            temp = data['temperature']
            humidity = data['humidity']
            a, b = 17.27, 237.7
            alpha = ((a * temp) / (b + temp)) + np.log(humidity / 100)
            data['dew_point'] = round((b * alpha) / (a - alpha), 2)
        
        return data

# ตัวอย่างการใช้งาน
if __name__ == "__main__":
    print("🚀 ทดสอบ Anomaly Detection API")
    print("=" * 50)
    
    # สร้าง API instance
    api = AnomalyDetectionAPI()
    
    # สร้างตัวจำลองข้อมูล
    simulator = SensorSimulator()
    
    print("\n🔍 ทดสอบการตรวจจับข้อมูลปกติ:")
    normal_data = simulator.generate_normal_data()
    print(f"📊 ข้อมูลปกติ:")
    for key, value in normal_data.items():
        if isinstance(value, float):
            print(f"  {key}: {value:.2f}")
        else:
            print(f"  {key}: {value}")
    
    # ทดสอบการตรวจจับ
    results = api.detect_anomalies_hybrid([normal_data])
    alert = api.generate_alert_message(results)
    
    print(f"\n{alert['icon']} ผลการตรวจจับ: {alert['title']}")
    print(f"📝 ข้อความ: {alert['message']}")
    
    print("\n" + "="*50)
    print("⚠️ ทดสอบการตรวจจับข้อมูลผิดปกติ:")
    
    anomaly_types = ['sudden_drop', 'vpd_too_low', 'low_voltage', 'dew_point_close']
    
    for anomaly_type in anomaly_types:
        print(f"\n🧪 ทดสอบ {anomaly_type}:")
        anomaly_data = simulator.generate_anomaly_data(anomaly_type)
        
        # แสดงข้อมูลที่สำคัญ
        key_data = {k: v for k, v in anomaly_data.items() if k in ['temperature', 'humidity', 'vpd', 'voltage', 'battery_level']}
        print(f"📊 ข้อมูล: {key_data}")
        
        # ทดสอบการตรวจจับ
        results = api.detect_anomalies_hybrid([anomaly_data])
        alert = api.generate_alert_message(results)
        
        print(f"{alert['icon']} ผลการตรวจจับ: {alert['title']}")
        if alert['level'] != 'info':
            print(f"📝 รายละเอียด: {alert['message'].split('Details:')[0].strip()}")
    
    print("\n✅ การทดสอบเสร็จสิ้น!")
    print("\n💡 วิธีใช้งาน:")
    print("  from anomaly_api import AnomalyDetectionAPI")
    print("  api = AnomalyDetectionAPI()")
    print("  results = api.detect_anomalies_hybrid(sensor_data)")