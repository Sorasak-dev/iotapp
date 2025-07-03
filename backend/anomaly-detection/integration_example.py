"""
การเชื่อมต่อระหว่าง Python Anomaly Detection กับ Express.js Server
รันไฟล์นี้เพื่อเริ่มต้นการติดตามความผิดปกติแบบ real-time
"""

import requests
import json
from datetime import datetime, timedelta
import time
import threading
from anomaly_api import AnomalyDetectionAPI, SensorSimulator
import logging
import sys
import os

# ตั้งค่า logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('anomaly_detection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AnomalyIntegrationService:
    """บริการเชื่อมต่อระหว่าง ML models กับ Express.js server"""
    
    def __init__(self, server_url="http://localhost:3000", models_path="models/anomaly_detection"):
        self.server_url = server_url
        self.anomaly_api = AnomalyDetectionAPI(models_path)
        self.simulator = SensorSimulator()  # สำหรับทดสอบ
        self.last_check_time = datetime.now()
        self.running = False
        
    def test_server_connection(self):
        """ทดสอบการเชื่อมต่อกับ Express.js server"""
        try:
            response = requests.get(f"{self.server_url}/", timeout=5)
            logger.info(f"✅ เชื่อมต่อ Express.js server สำเร็จ: {response.status_code}")
            return True
        except requests.exceptions.RequestException as e:
            logger.warning(f"⚠️ ไม่สามารถเชื่อมต่อ Express.js server: {e}")
            logger.info("💡 กรุณาเริ่มต้น Express.js server ก่อน หรือใช้โหมดทดสอบ")
            return False
    
    def get_device_list(self):
        """ดึงรายการอุปกรณ์จาก server"""
        try:
            response = requests.get(f"{self.server_url}/api/device-templates", timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return data.get('templates', [])
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ ไม่สามารถดึงรายการอุปกรณ์: {e}")
            # ใช้ข้อมูลเริ่มต้น
            return [
                {"id": "1", "name": "E-MIB1", "type": "Temperature & Humidity Sensor"},
                {"id": "2", "name": "E-MIB2", "type": "Temperature & Humidity Sensor"},
                {"id": "3", "name": "E-MIB3", "type": "Temperature & Humidity Sensor"},
                {"id": "4", "name": "E-MIB4", "type": "Temperature & Humidity Sensor"}
            ]
    
    def get_sensor_data(self, device_id):
        """ดึงข้อมูลเซ็นเซอร์จาก server (หรือจำลอง)"""
        try:
            # ลองดึงจาก server ก่อน
            response = requests.get(f"{self.server_url}/api/devices/{device_id}/data", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get('data', [])
        except:
            pass
        
        # ถ้าดึงจาก server ไม่ได้ ใช้ข้อมูลจำลอง
        logger.info(f"📊 ใช้ข้อมูลจำลองสำหรับอุปกรณ์ {device_id}")
        
        # สุ่มว่าจะเป็นข้อมูลปกติหรือผิดปกติ
        import random
        if random.random() < 0.8:  # 80% ปกติ
            return [self.simulator.generate_normal_data()]
        else:  # 20% ผิดปกติ
            anomaly_types = ['sudden_drop', 'vpd_too_low', 'low_voltage', 'dew_point_close']
            anomaly_type = random.choice(anomaly_types)
            return [self.simulator.generate_anomaly_data(anomaly_type)]
    
    def send_anomaly_alert(self, device_id, anomaly_results):
        """ส่งแจ้งเตือนความผิดปกติไปยัง server"""
        try:
            url = f"{self.server_url}/api/anomalies"
            
            alert_data = {
                'deviceId': device_id,
                'timestamp': datetime.now().isoformat(),
                'anomalyResults': anomaly_results,
                'alertLevel': anomaly_results.get('summary', {}).get('alert_level', 'yellow'),
                'message': self.anomaly_api.generate_alert_message(anomaly_results)
            }
            
            response = requests.post(url, json=alert_data, timeout=10)
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ ส่งแจ้งเตือนสำเร็จสำหรับอุปกรณ์ {device_id}")
                return True
            else:
                logger.warning(f"⚠️ ส่งแจ้งเตือนไม่สำเร็จ: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ ไม่สามารถส่งแจ้งเตือน: {e}")
        
        # บันทึกลงไฟล์แทน
        self.save_alert_to_file(device_id, anomaly_results)
        return False
    
    def save_alert_to_file(self, device_id, anomaly_results):
        """บันทึกแจ้งเตือนลงไฟล์"""
        try:
            os.makedirs("alerts", exist_ok=True)
            
            alert_data = {
                'deviceId': device_id,
                'timestamp': datetime.now().isoformat(),
                'anomalyResults': anomaly_results,
                'alertLevel': anomaly_results.get('summary', {}).get('alert_level', 'yellow')
            }
            
            filename = f"alerts/anomaly_alerts_{datetime.now().strftime('%Y%m%d')}.json"
            
            # อ่านไฟล์เก่า (ถ้ามี)
            alerts = []
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as f:
                    alerts = json.load(f)
            
            # เพิ่มแจ้งเตือนใหม่
            alerts.append(alert_data)
            
            # บันทึกลงไฟล์
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(alerts, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 บันทึกแจ้งเตือนลงไฟล์ {filename}")
            
        except Exception as e:
            logger.error(f"❌ ไม่สามารถบันทึกแจ้งเตือนลงไฟล์: {e}")
    
    def process_device_data(self, device_id, device_name):
        """ประมวลผลข้อมูลของอุปกรณ์หนึ่งตัว"""
        logger.info(f"🔍 ตรวจสอบอุปกรณ์ {device_name} (ID: {device_id})")
        
        # ดึงข้อมูลเซ็นเซอร์
        sensor_data = self.get_sensor_data(device_id)
        
        if not sensor_data:
            logger.warning(f"⚠️ ไม่มีข้อมูลสำหรับอุปกรณ์ {device_id}")
            return
        
        # ข้อมูลล่าสุด
        latest_data = sensor_data[-1] if sensor_data else None
        if not latest_data:
            return
        
        # ตรวจจับความผิดปกติ
        anomaly_results = self.anomaly_api.detect_anomalies_hybrid(
            sensor_data[-1:],  # ข้อมูลล่าสุด
            data_history=sensor_data  # ข้อมูลประวัติ
        )
        
        # ตรวจสอบว่ามีความผิดปกติหรือไม่
        has_anomalies = (
            anomaly_results.get('summary', {}).get('rule_anomalies_found', False) or
            anomaly_results.get('summary', {}).get('ml_anomalies_found', False)
        )
        
        if has_anomalies:
            alert_level = anomaly_results.get('summary', {}).get('alert_level', 'yellow')
            alert_icon = "🔴" if alert_level == 'red' else "⚠️"
            
            logger.warning(f"{alert_icon} พบความผิดปกติในอุปกรณ์ {device_name} - ระดับ {alert_level}")
            
            # แสดงรายละเอียด
            recommendations = anomaly_results.get('summary', {}).get('recommendations', [])
            for rec in recommendations:
                logger.warning(f"  - {rec.get('message', 'Unknown issue')}")
            
            # ส่งแจ้งเตือน
            self.send_anomaly_alert(device_id, anomaly_results)
        else:
            logger.info(f"✅ อุปกรณ์ {device_name} ทำงานปกติ")
    
    def check_all_devices(self):
        """ตรวจสอบอุปกรณ์ทั้งหมด"""
        try:
            logger.info("🔄 เริ่มต้นการตรวจสอบความผิดปกติ...")
            
            # ดึงรายการอุปกรณ์
            devices = self.get_device_list()
            logger.info(f"📱 พบอุปกรณ์ {len(devices)} ตัว")
            
            # ประมวลผลแต่ละอุปกรณ์
            for device in devices:
                device_id = device.get('id')
                device_name = device.get('name', f'Device-{device_id}')
                
                if device_id:
                    self.process_device_data(device_id, device_name)
                    time.sleep(1)  # หน่วงเวลาเล็กน้อยระหว่างอุปกรณ์
            
            self.last_check_time = datetime.now()
            logger.info(f"✅ ตรวจสอบเสร็จสิ้น - อุปกรณ์ทั้งหมด {len(devices)} ตัว")
            
        except Exception as e:
            logger.error(f"❌ เกิดข้อผิดพลาดในการตรวจสอบ: {e}")
    
    def start_monitoring(self, check_interval_minutes=10):
        """เริ่มต้นการติดตามอย่างต่อเนื่อง"""
        logger.info(f"🚀 เริ่มต้นการติดตามต่อเนื่อง (ทุก {check_interval_minutes} นาที)")
        
        self.running = True
        
        # เรียกใช้ครั้งแรกทันที
        self.check_all_devices()
        
        # รันอย่างต่อเนื่อง
        while self.running:
            try:
                # รอตามเวลาที่กำหนด
                time.sleep(check_interval_minutes * 60)
                
                if self.running:
                    self.check_all_devices()
                    
            except KeyboardInterrupt:
                logger.info("🛑 หยุดการติดตามโดยผู้ใช้")
                self.running = False
                break
            except Exception as e:
                logger.error(f"❌ เกิดข้อผิดพลาดในการติดตาม: {e}")
                time.sleep(60)  # รอ 1 นาทีก่อนลองใหม่
    
    def stop_monitoring(self):
        """หยุดการติดตาม"""
        self.running = False
        logger.info("🛑 หยุดการติดตาม")
    
    def run_single_check(self, device_id=None):
        """ตรวจสอบครั้งเดียว (สำหรับการทดสอบ)"""
        if device_id:
            devices = [{"id": device_id, "name": f"Device-{device_id}"}]
            for device in devices:
                self.process_device_data(device['id'], device['name'])
        else:
            self.check_all_devices()

def main():
    """ฟังก์ชันหลัก"""
    
    # พารามิเตอร์
    SERVER_URL = "http://localhost:3000"
    CHECK_INTERVAL = 5  # นาที (สำหรับ demo ใช้ 5 นาที)
    
    print("🚀 Anomaly Detection Integration Service")
    print("=" * 60)
    print(f"🌐 Express.js Server: {SERVER_URL}")
    print(f"⏰ Check Interval: {CHECK_INTERVAL} นาที")
    print("=" * 60)
    
    # สร้าง service
    service = AnomalyIntegrationService(server_url=SERVER_URL)
    
    # ทดสอบการเชื่อมต่อ
    server_connected = service.test_server_connection()
    
    if not server_connected:
        print("\n💡 เคล็ดลับ:")
        print("  1. เริ่มต้น Express.js server: npm start")
        print("  2. ตรวจสอบ URL: http://localhost:3000")
        print("  3. หรือใช้โหมดทดสอบ (ระบบจะใช้ข้อมูลจำลอง)")
        print()
        
        choice = input("📝 ต้องการดำเนินการต่อในโหมดทดสอบหรือไม่? (y/n): ").lower().strip()
        if choice != 'y':
            print("🛑 หยุดการทำงาน")
            return
    
    try:
        # เริ่มต้นการติดตาม
        service.start_monitoring(check_interval_minutes=CHECK_INTERVAL)
        
    except KeyboardInterrupt:
        print("\n🛑 หยุดการทำงานโดยผู้ใช้")
    except Exception as e:
        logger.error(f"❌ เกิดข้อผิดพลาดไม่คาดคิด: {e}")
    finally:
        service.stop_monitoring()
        print("✅ ปิดการทำงานเรียบร้อย")

# CLI Interface
if __name__ == "__main__":
    
    if len(sys.argv) < 2:
        print("🚀 Anomaly Detection Integration")
        print("=" * 40)
        print("Commands:")
        print("  python integration_example.py monitor    - เริ่มการติดตามต่อเนื่อง")
        print("  python integration_example.py check      - ตรวจสอบครั้งเดียว")
        print("  python integration_example.py test       - ทดสอบระบบ")
        print()
        
        choice = input("📝 เลือกคำสั่ง (monitor/check/test): ").lower().strip()
        if choice in ['monitor', 'check', 'test']:
            sys.argv.append(choice)
        else:
            print("❌ คำสั่งไม่ถูกต้อง")
            sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "monitor":
        # เริ่มต้นการติดตามอย่างต่อเนื่อง
        main()
    
    elif command == "check":
        # ตรวจสอบครั้งเดียว
        service = AnomalyIntegrationService()
        service.run_single_check()
    
    elif command == "test":
        # ทดสอบระบบ
        print("🧪 ทดสอบระบบ Anomaly Detection Integration")
        print("=" * 50)
        
        service = AnomalyIntegrationService()
        
        # ทดสอบการโหลดโมเดล
        print("1. ทดสอบการโหลดโมเดล...")
        if hasattr(service.anomaly_api.ml_detector, 'models'):
            print("   ✅ โหลดโมเดล ML สำเร็จ")
        else:
            print("   ⚠️ ไม่สามารถโหลดโมเดล ML")
        
        # ทดสอบการสร้างข้อมูล
        print("2. ทดสอบการสร้างข้อมูลจำลอง...")
        test_data = service.simulator.generate_normal_data()
        print(f"   ✅ สร้างข้อมูลปกติ: temperature={test_data['temperature']:.1f}°C")
        
        # ทดสอบการตรวจจับ
        print("3. ทดสอบการตรวจจับความผิดปกติ...")
        results = service.anomaly_api.detect_anomalies_hybrid([test_data])
        is_normal = not (results.get('summary', {}).get('rule_anomalies_found', False) or 
                        results.get('summary', {}).get('ml_anomalies_found', False))
        print(f"   ✅ การตรวจจับ: {'ปกติ' if is_normal else 'ผิดปกติ'}")
        
        # ทดสอบการเชื่อมต่อ server
        print("4. ทดสอบการเชื่อมต่อ Express.js...")
        connected = service.test_server_connection()
        
        # ทดสอบการตรวจสอบอุปกรณ์
        print("5. ทดสอบการตรวจสอบอุปกรณ์...")
        service.run_single_check()
        
        print("\n✅ การทดสอบเสร็จสิ้น!")
    
    else:
        print(f"❌ คำสั่งไม่ถูกต้อง: {command}")
        sys.exit(1)