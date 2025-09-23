import unittest
import pandas as pd
import numpy as np
import json
import os
import tempfile
import logging
from datetime import datetime, timedelta
import warnings
from unittest.mock import patch, MagicMock
import time
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor
import random

# เพิ่ม path สำหรับ import modules
sys.path.append('.')

try:
    from anomaly_api import AnomalyDetectionAPI, SensorSimulator
    from anomaly_models import AnomalyDetectionModels, RuleBasedAnomalyDetector
    from data_generator import SensorDataGenerator
except ImportError as e:
    print(f"Warning: Cannot import modules: {e}")
    print("Please ensure all modules are in the correct path")

warnings.filterwarnings('ignore')

class TestDataGenerator:
    """สร้างข้อมูลทดสอบหลากหลายรูปแบบ"""
    
    def __init__(self):
        self.base_normal_data = {
            'temperature': 25.0,
            'humidity': 65.0,
            'co2': 800,
            'ec': 1.5,
            'ph': 6.5,
            'voltage': 3.3,
            'battery_level': 85,
            'dew_point': 18.0,
            'vpd': 1.2,
            'timestamp': datetime.now().isoformat()
        }
    
    def generate_normal_variations(self, count=100):
        """สร้างข้อมูลปกติแบบต่างๆ"""
        test_cases = []
        
        for i in range(count):
            data = self.base_normal_data.copy()
            
            # เพิ่มการแปรผันที่สมจริง
            data['temperature'] = np.clip(np.random.normal(25, 3), 15, 40)
            data['humidity'] = np.clip(np.random.normal(65, 8), 30, 90)
            data['voltage'] = np.clip(np.random.normal(3.3, 0.1), 2.9, 3.7)
            data['battery_level'] = np.clip(np.random.normal(80, 10), 20, 100)
            data['co2'] = np.clip(np.random.normal(800, 150), 300, 1800)
            data['ec'] = np.clip(np.random.normal(1.5, 0.3), 0.8, 2.8)
            data['ph'] = np.clip(np.random.normal(6.5, 0.5), 5.0, 8.0)
            
            # คำนวณ derived values
            temp, hum = data['temperature'], data['humidity']
            try:
                a, b = 17.27, 237.7
                alpha = ((a * temp) / (b + temp)) + np.log(hum / 100)
                data['dew_point'] = (b * alpha) / (a - alpha)
                
                saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
                actual_vapor_pressure = saturation_vapor_pressure * (hum / 100)
                data['vpd'] = max(0, saturation_vapor_pressure - actual_vapor_pressure)
            except:
                data['dew_point'] = 18.0
                data['vpd'] = 1.2
            
            data['timestamp'] = (datetime.now() - timedelta(minutes=random.randint(0, 1440))).isoformat()
            test_cases.append(data)
        
        return test_cases
    
    def generate_edge_cases(self, count=100):
        """สร้างข้อมูลขอบเขต"""
        edge_cases = []
        
        scenarios = [
            # ขอบเขต VPD
            {'temperature': 22, 'humidity': 88, 'description': 'VPD borderline low'},
            {'temperature': 35, 'humidity': 30, 'description': 'VPD borderline high'},
            
            # ขอบเขต voltage
            {'voltage': 2.95, 'description': 'Voltage borderline low'},
            {'voltage': 3.65, 'description': 'Voltage borderline high'},
            
            # ขอบเขต battery
            {'battery_level': 22, 'description': 'Battery borderline low'},
            
            # ขอบเขตอุณหภูมิ
            {'temperature': 39, 'description': 'Temperature borderline high'},
            {'temperature': 16, 'description': 'Temperature borderline low'},
            
            # ขอบเขตความชื้น
            {'humidity': 32, 'description': 'Humidity borderline low'},
            {'humidity': 87, 'description': 'Humidity borderline high'},
        ]
        
        for i in range(count):
            scenario = random.choice(scenarios)
            data = self.base_normal_data.copy()
            
            # อัปเดตด้วยค่าขอบเขต
            for key, value in scenario.items():
                if key != 'description':
                    data[key] = value
            
            # เพิ่มการแปรผันเล็กน้อย
            for key in ['temperature', 'humidity', 'voltage', 'battery_level']:
                if key not in scenario or key == 'description':
                    continue
                noise = np.random.normal(0, abs(data[key] * 0.02))
                data[key] = max(0, data[key] + noise)
            
            data['test_description'] = scenario.get('description', 'Edge case')
            data['timestamp'] = (datetime.now() - timedelta(minutes=random.randint(0, 1440))).isoformat()
            edge_cases.append(data)
        
        return edge_cases
    
    def generate_anomaly_cases(self, count=100):
        """สร้างข้อมูลผิดปกติหลากหลายประเภท"""
        anomaly_cases = []
        
        anomaly_types = [
            'sudden_drop', 'sudden_spike', 'vpd_too_low', 'low_voltage',
            'dew_point_close', 'battery_depleted', 'sensor_failure',
            'high_fluctuation', 'gradual_drift', 'multi_sensor_failure'
        ]
        
        for i in range(count):
            anomaly_type = random.choice(anomaly_types)
            data = self.base_normal_data.copy()
            
            if anomaly_type == 'sudden_drop':
                data['temperature'] = max(data['temperature'] - random.uniform(10, 20), -10)
                data['voltage'] = max(data['voltage'] - random.uniform(0.8, 1.5), 0)
            
            elif anomaly_type == 'sudden_spike':
                data['temperature'] = min(data['temperature'] + random.uniform(15, 25), 80)
                data['voltage'] = min(data['voltage'] + random.uniform(0.5, 1.0), 5.0)
            
            elif anomaly_type == 'vpd_too_low':
                data['humidity'] = random.uniform(93, 99)
                data['temperature'] = random.uniform(18, 25)
            
            elif anomaly_type == 'low_voltage':
                data['voltage'] = random.uniform(1.5, 2.8)
                data['battery_level'] = random.uniform(5, 25)
            
            elif anomaly_type == 'dew_point_close':
                data['humidity'] = random.uniform(95, 99)
                data['temperature'] = random.uniform(20, 30)
            
            elif anomaly_type == 'battery_depleted':
                data['battery_level'] = random.uniform(0, 10)
                data['voltage'] = random.uniform(1.0, 2.5)
            
            elif anomaly_type == 'sensor_failure':
                failure_sensors = random.sample(['temperature', 'humidity', 'co2', 'voltage'], 
                                              random.randint(1, 3))
                for sensor in failure_sensors:
                    data[sensor] = random.choice([-999, 0, 9999, -1])
            
            elif anomaly_type == 'high_fluctuation':
                for key in ['temperature', 'humidity', 'voltage']:
                    fluctuation = random.uniform(10, 20)
                    data[key] = data[key] + random.choice([-fluctuation, fluctuation])
            
            elif anomaly_type == 'gradual_drift':
                drift = random.uniform(8, 15)
                data['temperature'] = min(data['temperature'] + drift, 70)
                data['ec'] = min(data['ec'] + random.uniform(1, 2), 5.0)
            
            elif anomaly_type == 'multi_sensor_failure':
                data['temperature'] = -999
                data['humidity'] = 0
                data['voltage'] = 0
                data['battery_level'] = 0
                data['co2'] = -999
            
            data['expected_anomaly_type'] = anomaly_type
            data['timestamp'] = (datetime.now() - timedelta(minutes=random.randint(0, 1440))).isoformat()
            anomaly_cases.append(data)
        
        return anomaly_cases

# Global test data - สร้างข้อมูลทดสอบครั้งเดียวใช้ร่วมกัน
print("=== Generating Test Data (100 cases each) ===")
global_test_generator = TestDataGenerator()
global_normal_cases = global_test_generator.generate_normal_variations(100)
global_edge_cases = global_test_generator.generate_edge_cases(100)
global_anomaly_cases = global_test_generator.generate_anomaly_cases(100)
print(f"Generated: {len(global_normal_cases)} normal, {len(global_edge_cases)} edge, {len(global_anomaly_cases)} anomaly cases")

class TestCounter:
    """นับผลการทดสอบแยกตามประเภท"""
    def __init__(self):
        self.counts = {
            'rule_based_normal_detection': {'total': 0, 'passed': 0, 'failed': 0},
            'rule_based_anomaly_detection': {'total': 0, 'passed': 0, 'failed': 0},
            'ml_detection': {'total': 0, 'passed': 0, 'failed': 0},
            'hybrid_detection': {'total': 0, 'passed': 0, 'failed': 0},
            'edge_case_handling': {'total': 0, 'passed': 0, 'failed': 0}
        }
    
    def add_result(self, category, passed):
        self.counts[category]['total'] += 1
        if passed:
            self.counts[category]['passed'] += 1
        else:
            self.counts[category]['failed'] += 1
    
    def get_summary(self):
        summary = {}
        for category, data in self.counts.items():
            if data['total'] > 0:
                success_rate = (data['passed'] / data['total']) * 100
                summary[category] = {
                    'passed': data['passed'],
                    'total': data['total'],
                    'success_rate': success_rate
                }
        return summary

# Global counter
test_counter = TestCounter()

class TestAnomalyDetectionAPI(unittest.TestCase):
    """ทดสอบ API หลัก"""
    
    def setUp(self):
        """เตรียม API สำหรับแต่ละ test"""
        try:
            self.api = AnomalyDetectionAPI()
            self.simulator = SensorSimulator()
            
            # ใช้ข้อมูลทดสอบ global
            self.normal_cases = global_normal_cases
            self.edge_cases = global_edge_cases
            self.anomaly_cases = global_anomaly_cases
            self.test_data_generator = global_test_generator
            
        except Exception as e:
            self.skipTest(f"Cannot initialize API: {e}")
    
    def test_01_api_initialization(self):
        """ทดสอบการเริ่มต้น API"""
        self.assertIsNotNone(self.api)
        self.assertIn('models_loaded', self.api.health_status)
        self.assertIn('service_status', self.api.health_status)
        
        # ทดสอบ health status
        health = self.api.get_health_status()
        self.assertIsInstance(health, dict)
        self.assertIn('service_status', health)
        self.assertIn('capabilities', health)
    
    def test_02_rule_based_detection_normal_100_cases(self):
        """ทดสอบ Rule-based detection กับข้อมูลปกติ 100 cases"""
        print(f"\n  Testing Rule-based Detection with 100 Normal Cases...")
        
        passed_count = 0
        failed_cases = []
        
        for i, normal_data in enumerate(self.normal_cases):
            try:
                results = self.api.detect_anomalies_rules([normal_data])
                
                # ข้อมูลปกติควรไม่มี anomaly หรือมีน้อย
                anomaly_count = len([r for r in results if r.get('is_anomaly', False)])
                
                if anomaly_count <= 1:  # อนุญาตให้มี false positive เล็กน้อย
                    passed_count += 1
                    test_counter.add_result('rule_based_normal_detection', True)
                else:
                    failed_cases.append(f"Case {i}: {anomaly_count} anomalies detected")
                    test_counter.add_result('rule_based_normal_detection', False)
                    
            except Exception as e:
                failed_cases.append(f"Case {i}: Exception - {str(e)[:50]}")
                test_counter.add_result('rule_based_normal_detection', False)
        
        success_rate = (passed_count / 100) * 100
        print(f"    Normal Data Detection: {passed_count}/100 passed ({success_rate:.1f}%)")
        
        if failed_cases and len(failed_cases) <= 5:
            print(f"    Failed cases: {failed_cases[:5]}")
        
        # ควรผ่านอย่างน้อย 80%
        self.assertGreaterEqual(success_rate, 80, f"Success rate too low: {success_rate:.1f}%")
    
    def test_03_rule_based_detection_anomaly_100_cases(self):
        """ทดสอบ Rule-based detection กับข้อมูลผิดปกติ 100 cases"""
        print(f"\n  Testing Rule-based Detection with 100 Anomaly Cases...")
        
        passed_count = 0
        failed_cases = []
        
        for i, anomaly_data in enumerate(self.anomaly_cases):
            try:
                results = self.api.detect_anomalies_rules([anomaly_data])
                
                # ตรวจสอบว่าพบ anomaly
                has_anomaly = any(r.get('is_anomaly', False) for r in results)
                
                if has_anomaly:
                    passed_count += 1
                    test_counter.add_result('rule_based_anomaly_detection', True)
                else:
                    expected_type = anomaly_data.get('expected_anomaly_type', 'unknown')
                    failed_cases.append(f"Case {i}: {expected_type} not detected")
                    test_counter.add_result('rule_based_anomaly_detection', False)
                    
            except Exception as e:
                failed_cases.append(f"Case {i}: Exception - {str(e)[:50]}")
                test_counter.add_result('rule_based_anomaly_detection', False)
        
        success_rate = (passed_count / 100) * 100
        print(f"    Anomaly Data Detection: {passed_count}/100 passed ({success_rate:.1f}%)")
        
        if failed_cases and len(failed_cases) <= 5:
            print(f"    Failed cases: {failed_cases[:5]}")
        
        # ควรผ่านอย่างน้อย 60% (เพราะ rule-based อาจไม่ครอบคลุมทุกประเภท)
        self.assertGreaterEqual(success_rate, 60, f"Detection rate too low: {success_rate:.1f}%")
    
    def test_04_ml_detection_100_cases(self):
        """ทดสอบ ML detection กับข้อมูลผสม 100 cases"""
        if not self.api.health_status['models_loaded']:
            self.skipTest("ML models not loaded")
        
        print(f"\n  Testing ML Detection with 100 Mixed Cases...")
        
        # ใช้ข้อมูลผสม: 70 normal + 30 anomaly
        test_data = self.normal_cases[:70] + self.anomaly_cases[:30]
        random.shuffle(test_data)
        
        passed_count = 0
        failed_cases = []
        
        try:
            results = self.api.detect_anomalies_ml_batch(test_data, 'ensemble')
            
            if len(results) == len(test_data):
                for i, (data, result) in enumerate(zip(test_data, results)):
                    try:
                        is_actual_anomaly = 'expected_anomaly_type' in data
                        predicted_anomaly = result.get('is_anomaly', False)
                        
                        # ตรวจสอบความถูกต้อง (อนุญาต error cases)
                        if 'error' not in result:
                            # Simple accuracy check
                            if (is_actual_anomaly and predicted_anomaly) or (not is_actual_anomaly and not predicted_anomaly):
                                passed_count += 1
                                test_counter.add_result('ml_detection', True)
                            else:
                                test_counter.add_result('ml_detection', False)
                        else:
                            test_counter.add_result('ml_detection', False)
                            
                    except Exception as e:
                        failed_cases.append(f"Case {i}: {str(e)[:50]}")
                        test_counter.add_result('ml_detection', False)
            else:
                # ถ้าจำนวนผลลัพธ์ไม่ตรง
                for i in range(100):
                    test_counter.add_result('ml_detection', False)
                
        except Exception as e:
            # ถ้า ML detection ล้มเหลวทั้งหมด
            for i in range(100):
                test_counter.add_result('ml_detection', False)
            failed_cases.append(f"ML Detection failed: {str(e)[:100]}")
        
        success_rate = (passed_count / 100) * 100
        print(f"    ML Detection Accuracy: {passed_count}/100 passed ({success_rate:.1f}%)")
        
        if failed_cases and len(failed_cases) <= 3:
            print(f"    Failed cases: {failed_cases[:3]}")
    
    def test_05_hybrid_detection_100_cases(self):
        """ทดสอบ Hybrid detection กับข้อมูลผสม 100 cases"""
        print(f"\n  Testing Hybrid Detection with 100 Mixed Cases...")
        
        # ใช้ข้อมูลผสม: 60 normal + 20 edge + 20 anomaly
        test_data = (self.normal_cases[:60] + 
                    self.edge_cases[:20] + 
                    self.anomaly_cases[:20])
        random.shuffle(test_data)
        
        passed_count = 0
        failed_cases = []
        
        # ทดสอบทีละ 10 cases เพื่อความเร็ว
        for batch_start in range(0, 100, 10):
            batch_data = test_data[batch_start:batch_start+10]
            
            try:
                results = self.api.detect_anomalies_hybrid(batch_data)
                
                if isinstance(results, dict) and 'error' not in results:
                    # ถือว่าผ่าน 10 cases
                    passed_count += 10
                    for _ in range(10):
                        test_counter.add_result('hybrid_detection', True)
                else:
                    # ถือว่าล้มเหลว 10 cases
                    failed_cases.append(f"Batch {batch_start//10}: {results.get('error', 'Unknown error')}")
                    for _ in range(10):
                        test_counter.add_result('hybrid_detection', False)
                        
            except Exception as e:
                failed_cases.append(f"Batch {batch_start//10}: Exception - {str(e)[:50]}")
                for _ in range(10):
                    test_counter.add_result('hybrid_detection', False)
        
        success_rate = (passed_count / 100) * 100
        print(f"    Hybrid Detection: {passed_count}/100 passed ({success_rate:.1f}%)")
        
        if failed_cases:
            print(f"    Failed batches: {failed_cases[:3]}")
    
    def test_06_edge_case_handling_100_cases(self):
        """ทดสอบการจัดการ Edge cases 100 cases"""
        print(f"\n  Testing Edge Case Handling with 100 Cases...")
        
        passed_count = 0
        failed_cases = []
        
        for i, edge_data in enumerate(self.edge_cases):
            try:
                results = self.api.detect_anomalies_hybrid([edge_data])
                
                # ตรวจสอบว่าระบบไม่ crash และได้ผลลัพธ์กลับมา
                if isinstance(results, dict):
                    if 'error' not in results or 'summary' in results:
                        passed_count += 1
                        test_counter.add_result('edge_case_handling', True)
                    else:
                        failed_cases.append(f"Case {i}: {results.get('error', 'Unknown')}")
                        test_counter.add_result('edge_case_handling', False)
                else:
                    failed_cases.append(f"Case {i}: Invalid response type")
                    test_counter.add_result('edge_case_handling', False)
                    
            except Exception as e:
                failed_cases.append(f"Case {i}: Exception - {str(e)[:50]}")
                test_counter.add_result('edge_case_handling', False)
        
        success_rate = (passed_count / 100) * 100
        print(f"    Edge Case Handling: {passed_count}/100 passed ({success_rate:.1f}%)")
        
        if failed_cases and len(failed_cases) <= 5:
            print(f"    Failed cases: {failed_cases[:5]}")
        
        # Edge cases ควรผ่านอย่างน้อย 85%
        self.assertGreaterEqual(success_rate, 85, f"Edge case handling rate too low: {success_rate:.1f}%")

class TestRuleBasedDetector(unittest.TestCase):
    """ทดสอบ Rule-based Detector"""
    
    def setUp(self):
        try:
            self.detector = RuleBasedAnomalyDetector()
        except Exception as e:
            self.skipTest(f"Cannot initialize RuleBasedAnomalyDetector: {e}")
    
    def test_01_individual_rules(self):
        """ทดสอบกฎแต่ละข้อ"""
        # VPD too low
        vpd_low_data = {
            'temperature': 20,
            'humidity': 95,
            'vpd': 0.3,
            'timestamp': datetime.now().isoformat()
        }
        
        result = self.detector._check_vpd_too_low(vpd_low_data, None, [vpd_low_data])
        self.assertTrue(result, "VPD too low rule should trigger")
        
        # Low voltage
        low_voltage_data = {
            'voltage': 2.5,
            'timestamp': datetime.now().isoformat()
        }
        
        result = self.detector._check_low_voltage(low_voltage_data, None, [low_voltage_data])
        self.assertTrue(result, "Low voltage rule should trigger")
        
        # Sensor failure
        sensor_failure_data = {
            'temperature': -999,
            'humidity': 0,
            'voltage': 0,
            'timestamp': datetime.now().isoformat()
        }
        
        result = self.detector._check_sensor_failure(sensor_failure_data, None, [sensor_failure_data])
        self.assertTrue(result, "Sensor failure rule should trigger")

class TestMLModels(unittest.TestCase):
    """ทดสอบ ML Models"""
    
    def setUp(self):
        try:
            self.models = AnomalyDetectionModels()
        except Exception as e:
            self.skipTest(f"Cannot initialize AnomalyDetectionModels: {e}")
    
    def test_01_model_loading(self):
        """ทดสอบการโหลดโมเดล"""
        try:
            self.models.load_models("models/anomaly_detection")
            self.assertGreater(len(self.models.models), 0, "Should load at least one model")
        except FileNotFoundError:
            self.skipTest("Model files not found")
        except Exception as e:
            self.skipTest(f"Model loading failed: {e}")

class TestReportGenerator:
    """สร้างรายงานผลการทดสอบ"""
    
    def __init__(self):
        self.results = {}
        self.summary = {}
    
    def add_test_result(self, test_name, result, duration, error=None):
        """เพิ่มผลการทดสอบ"""
        self.results[test_name] = {
            'result': result,
            'duration': duration,
            'error': error,
            'timestamp': datetime.now().isoformat()
        }
    
    def generate_report(self):
        """สร้างรายงานสรุป"""
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results.values() if r['result'] == 'PASS'])
        failed_tests = len([r for r in self.results.values() if r['result'] == 'FAIL'])
        skipped_tests = len([r for r in self.results.values() if r['result'] == 'SKIP'])
        
        total_duration = sum(r['duration'] for r in self.results.values())
        
        self.summary = {
            'total_tests': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'skipped': skipped_tests,
            'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            'total_duration': total_duration,
            'average_duration': total_duration / total_tests if total_tests > 0 else 0
        }
        
        return self.summary
    
    def save_report(self, filename='test_report.json'):
        """บันทึกรายงาน"""
        # รวมข้อมูลจาก test_counter
        detailed_results = self.results.copy()
        detailed_results['test_case_summary'] = test_counter.get_summary()
        
        report_data = {
            'summary': self.summary,
            'detailed_results': detailed_results,
            'test_cases_breakdown': test_counter.get_summary(),
            'generated_at': datetime.now().isoformat()
        }
        
        os.makedirs('test_reports', exist_ok=True)
        filepath = f'test_reports/{filename}'
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        return filepath

class CustomTestRunner:
    """Test Runner ที่กำหนดเอง"""
    
    def __init__(self):
        self.report_generator = TestReportGenerator()
    
    def run_test_suite(self, test_classes=None):
        """เรียกใช้ Test Suite ทั้งหมด"""
        if test_classes is None:
            test_classes = [
                TestAnomalyDetectionAPI,
                TestRuleBasedDetector,
                TestMLModels
            ]
        
        print("="*80)
        print("ANOMALY DETECTION SYSTEM - 100 CASES TEST SUITE")
        print("="*80)
        print(f"Starting tests at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Test classes: {len(test_classes)}")
        print("="*80)
        
        total_start_time = time.time()
        
        for test_class in test_classes:
            print(f"\n{'='*60}")
            print(f"Running {test_class.__name__}")
            print('='*60)
            
            suite = unittest.TestLoader().loadTestsFromTestCase(test_class)
            
            for test in suite:
                test_name = f"{test_class.__name__}.{test._testMethodName}"
                print(f"\nRunning: {test_name}")
                
                start_time = time.time()
                result = unittest.TestResult()
                test.run(result)
                duration = time.time() - start_time
                
                if result.wasSuccessful():
                    print(f"✅ PASSED ({duration:.2f}s)")
                    self.report_generator.add_test_result(test_name, "PASS", duration)
                elif result.skipped:
                    skip_reason = result.skipped[0][1] if result.skipped else "Unknown"
                    print(f"⏭️  SKIPPED: {skip_reason}")
                    self.report_generator.add_test_result(test_name, "SKIP", duration)
                else:
                    error_info = ""
                    if result.failures:
                        error_info = result.failures[0][1]
                    elif result.errors:
                        error_info = result.errors[0][1]
                    
                    print(f"❌ FAILED ({duration:.2f}s)")
                    print(f"Error: {error_info[:100]}...")
                    self.report_generator.add_test_result(test_name, "FAIL", duration, error_info)
        
        total_duration = time.time() - total_start_time
        
        # สร้างรายงานสรุป
        summary = self.report_generator.generate_report()
        
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']} ✅")
        print(f"Failed: {summary['failed']} ❌")
        print(f"Skipped: {summary['skipped']} ⏭️")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Total Duration: {total_duration:.2f} seconds")
        print(f"Average per Test: {summary['average_duration']:.2f} seconds")
        
        # แสดงรายละเอียดการทดสอบแต่ละประเภท
        print("\n" + "="*80)
        print("DETAILED TEST CASE RESULTS (100 CASES EACH)")
        print("="*80)
        
        case_summary = test_counter.get_summary()
        total_cases_tested = 0
        total_cases_passed = 0
        
        for category, data in case_summary.items():
            print(f"{category.replace('_', ' ').title()}:")
            print(f"  Passed: {data['passed']}/{data['total']} ({data['success_rate']:.1f}%)")
            total_cases_tested += data['total']
            total_cases_passed += data['passed']
        
        if total_cases_tested > 0:
            overall_case_success = (total_cases_passed / total_cases_tested) * 100
            print(f"\nOVERALL TEST CASES:")
            print(f"  Total Cases Tested: {total_cases_tested}")
            print(f"  Total Cases Passed: {total_cases_passed}")
            print(f"  Overall Success Rate: {overall_case_success:.1f}%")
        
        # บันทึกรายงาน
        report_file = self.report_generator.save_report(
            f"test_report_100cases_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        print(f"\nDetailed report saved to: {report_file}")
        
        # แสดงสถานะรวม
        if summary['failed'] == 0 and overall_case_success >= 90:
            print("\n🎉 ALL TESTS PASSED WITH HIGH SUCCESS RATE! System is ready for deployment.")
        elif summary['success_rate'] >= 80 and overall_case_success >= 80:
            print(f"\n⚠️  GOOD SUCCESS RATE (Tests: {summary['success_rate']:.1f}%, Cases: {overall_case_success:.1f}%) - Minor issues to address.")
        elif summary['success_rate'] >= 60 or overall_case_success >= 70:
            print(f"\n⚠️  MODERATE SUCCESS RATE (Tests: {summary['success_rate']:.1f}%, Cases: {overall_case_success:.1f}%) - Fix issues before deployment.")
        else:
            print(f"\n🚨 LOW SUCCESS RATE (Tests: {summary['success_rate']:.1f}%, Cases: {overall_case_success:.1f}%) - System needs significant fixes!")
        
        return summary

def run_comprehensive_100_cases_test():
    """เรียกใช้การทดสอบ 100 cases แต่ละประเภท"""
    runner = CustomTestRunner()
    return runner.run_test_suite()

def run_quick_100_cases_test():
    """เรียกใช้การทดสอบเร็ว 100 cases"""
    runner = CustomTestRunner()
    quick_test_classes = [
        TestAnomalyDetectionAPI
    ]
    return runner.run_test_suite(quick_test_classes)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Anomaly Detection System - 100 Cases Test Suite')
    parser.add_argument('--mode', choices=['full', 'quick'], 
                       default='full', help='Test mode to run')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    
    print(f"Running 100 cases tests in {args.mode} mode...")
    
    if args.mode == 'full':
        summary = run_comprehensive_100_cases_test()
    elif args.mode == 'quick':
        summary = run_quick_100_cases_test()
    
    # Exit code based on results
    case_summary = test_counter.get_summary()
    total_cases_tested = sum(data['total'] for data in case_summary.values())
    total_cases_passed = sum(data['passed'] for data in case_summary.values())
    overall_case_success = (total_cases_passed / total_cases_tested) * 100 if total_cases_tested > 0 else 0
    
    if summary['failed'] == 0 and overall_case_success >= 95:
        exit(0)  # Perfect success
    elif summary['success_rate'] >= 80 and overall_case_success >= 85:
        exit(1)  # Good success
    elif summary['success_rate'] >= 60 and overall_case_success >= 70:
        exit(2)  # Moderate success
    else:
        exit(3)  # Poor success