import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from anomaly_models import AnomalyDetectionModels, RuleBasedAnomalyDetector
import warnings
import logging
from typing import Dict, List, Optional, Union
import time
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AnomalyDetectionAPI:
    """Enhanced API สำหรับการใช้งานโมเดล Anomaly Detection"""
    
    def __init__(self, models_path="models/anomaly_detection", batch_size=1000):
        self.models_path = models_path
        self.batch_size = batch_size
        self.ml_detector = AnomalyDetectionModels()
        self.rule_detector = RuleBasedAnomalyDetector()
        self.feature_columns = [
            'temperature', 'humidity', 'co2', 'ec', 'ph', 
            'dew_point', 'vpd', 'voltage', 'battery_level'
        ]
        self.time_features = ['hour', 'day_of_week', 'month']
        
        # Performance metrics tracking
        self.performance_metrics = {
            'last_check': None,
            'model_accuracy': None,
            'prediction_count': 0,
            'error_count': 0,
            'average_response_time': 0.0
        }
        
        # Health status
        self.health_status = {
            'models_loaded': False,
            'last_error': None,
            'service_status': 'initializing'
        }
        
        # Load models with error handling
        self.load_models()
    
    def load_models(self):
        """โหลดโมเดลที่เทรนแล้วพร้อม error handling"""
        try:
            logger.info("🔄 Loading ML models...")
            self.ml_detector.load_models(self.models_path)
            self.health_status['models_loaded'] = True
            self.health_status['service_status'] = 'active'
            logger.info("✅ โหลดโมเดล ML สำเร็จ")
        except Exception as e:
            logger.error(f"⚠️ ไม่สามารถโหลดโมเดล ML: {e}")
            self.health_status['models_loaded'] = False
            self.health_status['last_error'] = str(e)
            self.health_status['service_status'] = 'degraded'
            logger.info("💡 รันคำสั่ง: python train_models.py เพื่อสร้างโมเดล")
    
    def validate_sensor_data(self, sensor_data: Union[Dict, List[Dict]]) -> bool:
        """Validate input sensor data"""
        try:
            if isinstance(sensor_data, dict):
                sensor_data = [sensor_data]
            
            for data in sensor_data:
                if not isinstance(data, dict):
                    return False
                
                # Check for required fields (at least some sensor values)
                has_sensor_data = any(
                    key in data and data[key] is not None 
                    for key in ['temperature', 'humidity', 'voltage']
                )
                
                if not has_sensor_data:
                    logger.warning("⚠️ No valid sensor data found")
                    return False
                    
                # Validate data ranges
                if 'temperature' in data and data['temperature'] is not None:
                    if not -50 <= data['temperature'] <= 100:
                        logger.warning(f"⚠️ Temperature out of range: {data['temperature']}")
                        return False
                        
                if 'humidity' in data and data['humidity'] is not None:
                    if not 0 <= data['humidity'] <= 100:
                        logger.warning(f"⚠️ Humidity out of range: {data['humidity']}")
                        return False
                        
                if 'voltage' in data and data['voltage'] is not None:
                    if not 0 <= data['voltage'] <= 5:
                        logger.warning(f"⚠️ Voltage out of range: {data['voltage']}")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Validation error: {e}")
            return False
    
    def preprocess_sensor_data(self, sensor_data):
        """เตรียมข้อมูลเซ็นเซอร์สำหรับการทำนายพร้อม error handling"""
        try:
            if isinstance(sensor_data, dict):
                sensor_data = [sensor_data]
            
            df = pd.DataFrame(sensor_data)
            
            # แปลง timestamp
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
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
                    mean_val = df[col].mean() if not df[col].isnull().all() else 0
                    df[col] = df[col].fillna(mean_val)
            
            # เลือก features ที่ต้องการ
            missing_cols = [f'{col}_is_missing' for col in self.feature_columns]
            all_features = self.feature_columns + self.time_features + missing_cols
            
            # สร้างคอลัมน์ที่ไม่มีและเติมค่า 0
            for feature in all_features:
                if feature not in df.columns:
                    df[feature] = 0
            
            return df[all_features].values
            
        except Exception as e:
            logger.error(f"❌ Preprocessing error: {e}")
            raise
    
    def detect_anomalies_ml_batch(self, sensor_data, model_name='ensemble'):
        """ตรวจจับความผิดปกติด้วยโมเดล ML แบบ batch processing"""
        start_time = time.time()
        
        try:
            if not self.health_status['models_loaded']:
                logger.warning("⚠️ ML models not loaded, using fallback")
                return [{'is_anomaly': False, 'error': 'Models not available'}]
            
            X = self.preprocess_sensor_data(sensor_data)
            results = []
            
            # Process in batches for large datasets
            for i in range(0, len(X), self.batch_size):
                batch = X[i:i + self.batch_size]
                batch_predictions = self.ml_detector.predict_anomalies(batch, model_name)
                
                for j, pred in enumerate(batch_predictions):
                    results.append({
                        'is_anomaly': bool(pred),
                        'confidence': float(pred),
                        'model_used': model_name,
                        'timestamp': datetime.now().isoformat(),
                        'batch_index': i + j
                    })
            
            # Update performance metrics
            response_time = time.time() - start_time
            self.performance_metrics['prediction_count'] += len(results)
            self.performance_metrics['average_response_time'] = (
                (self.performance_metrics['average_response_time'] * 
                 (self.performance_metrics['prediction_count'] - len(results)) + 
                 response_time) / self.performance_metrics['prediction_count']
            )
            
            logger.info(f"✅ ML detection completed: {len(results)} predictions in {response_time:.2f}s")
            return results
            
        except Exception as e:
            self.performance_metrics['error_count'] += 1
            self.health_status['last_error'] = str(e)
            logger.error(f"❌ เกิดข้อผิดพลาดในการตรวจจับด้วย ML: {e}")
            return [{'is_anomaly': False, 'error': str(e)}]
    
    def detect_anomalies_rules(self, sensor_data, data_history=None):
        """ตรวจจับความผิดปกติด้วยกฎที่กำหนดพร้อม enhanced error handling"""
        try:
            # Validate input data first
            if not self.validate_sensor_data(sensor_data):
                return [{'is_anomaly': False, 'error': 'Invalid sensor data'}]
            
            anomalies = self.rule_detector.detect_anomalies(sensor_data, data_history)
            
            results = []
            for anomaly in anomalies:
                results.append({
                    'is_anomaly': True,
                    'anomaly_type': anomaly['type'],
                    'alert_level': anomaly['alert_level'],
                    'message': anomaly['message'],
                    'timestamp': anomaly['timestamp'],
                    'detection_method': 'rule_based',
                    'confidence': anomaly.get('confidence', 1.0)
                })
            
            # ถ้าไม่พบความผิดปกติ
            if not results:
                results.append({
                    'is_anomaly': False,
                    'message': 'Sensor operating normally',
                    'detection_method': 'rule_based',
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"✅ Rule-based detection completed: {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"❌ เกิดข้อผิดพลาดในการตรวจจับด้วยกฎ: {e}")
            return [{'is_anomaly': False, 'error': str(e)}]
    
    def detect_anomalies_hybrid(self, sensor_data, data_history=None, ml_model='ensemble'):
        """Enhanced hybrid detection with better error handling and performance tracking"""
        start_time = time.time()
        
        try:
            # Validate input first
            if not self.validate_sensor_data(sensor_data):
                return {
                    'error': 'Invalid sensor data',
                    'timestamp': datetime.now().isoformat()
                }
            
            # ตรวจจับด้วยกฎ (ทำก่อนเพราะเร็วกว่า)
            rule_results = self.detect_anomalies_rules(sensor_data, data_history)
            
            # ตรวจจับด้วย ML (ถ้า models พร้อม)
            ml_results = []
            if self.health_status['models_loaded']:
                ml_results = self.detect_anomalies_ml_batch(sensor_data, ml_model)
            else:
                logger.warning("⚠️ ML models not available, using rule-based only")
                ml_results = [{'is_anomaly': False, 'error': 'ML models not loaded'}]
            
            # รวมผลลัพธ์พร้อม enhanced analysis
            combined_results = {
                'rule_based_detection': rule_results,
                'ml_detection': ml_results,
                'summary': self._analyze_combined_results(rule_results, ml_results),
                'performance': {
                    'response_time': time.time() - start_time,
                    'models_available': self.health_status['models_loaded'],
                    'data_points_processed': len(sensor_data) if isinstance(sensor_data, list) else 1
                }
            }
            
            combined_results['timestamp'] = datetime.now().isoformat()
            
            logger.info(f"✅ Hybrid detection completed in {combined_results['performance']['response_time']:.2f}s")
            return combined_results
            
        except Exception as e:
            self.performance_metrics['error_count'] += 1
            logger.error(f"❌ Hybrid detection error: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'performance': {
                    'response_time': time.time() - start_time,
                    'models_available': self.health_status['models_loaded']
                }
            }
    
    def _analyze_combined_results(self, rule_results, ml_results):
        """Enhanced analysis of combined results"""
        rule_anomalies = [r for r in rule_results if r.get('is_anomaly', False)]
        ml_anomalies = [r for r in ml_results if r.get('is_anomaly', False)]
        
        # Calculate confidence scores
        rule_confidence = max([r.get('confidence', 0) for r in rule_anomalies], default=0)
        ml_confidence = max([r.get('confidence', 0) for r in ml_anomalies], default=0)
        
        # Determine overall severity
        alert_level = 'green'
        priority_score = 0
        
        if rule_anomalies:
            alert_levels = [r.get('alert_level', 'yellow') for r in rule_anomalies]
            if 'red' in alert_levels:
                alert_level = 'red'
                priority_score = 3
            elif 'yellow' in alert_levels:
                alert_level = 'yellow'
                priority_score = 2
        elif ml_anomalies:
            alert_level = 'yellow'
            priority_score = 1
        
        # Generate enhanced recommendations
        recommendations = self._generate_recommendations(rule_anomalies, ml_anomalies)
        
        return {
            'rule_anomalies_found': len(rule_anomalies) > 0,
            'ml_anomalies_found': len(ml_anomalies) > 0,
            'total_anomalies': len(rule_anomalies) + len(ml_anomalies),
            'alert_level': alert_level,
            'priority_score': priority_score,
            'confidence_scores': {
                'rule_based': rule_confidence,
                'ml_based': ml_confidence,
                'combined': max(rule_confidence, ml_confidence)
            },
            'recommendations': recommendations
        }
    
    def _generate_recommendations(self, rule_anomalies, ml_anomalies):
        """Generate actionable recommendations"""
        recommendations = []
        
        # Rule-based recommendations
        for anomaly in rule_anomalies:
            rec = {
                'type': anomaly.get('anomaly_type', 'unknown'),
                'message': anomaly.get('message', ''),
                'priority': 'high' if anomaly.get('alert_level') == 'red' else 'medium',
                'action': self._get_action_for_anomaly(anomaly.get('anomaly_type'))
            }
            recommendations.append(rec)
        
        # ML-based recommendations
        if ml_anomalies and not rule_anomalies:
            recommendations.append({
                'type': 'general_anomaly',
                'message': 'Machine learning model detected unusual patterns',
                'priority': 'medium',
                'action': 'Monitor system closely and check for patterns'
            })
        
        return recommendations
    
    def _get_action_for_anomaly(self, anomaly_type):
        """Get specific actions for each anomaly type"""
        actions = {
            'vpd_too_low': 'Check ventilation system and adjust humidity levels',
            'dew_point_close': 'Increase air circulation to prevent mold growth',
            'low_voltage': 'Check power supply and electrical connections',
            'battery_depleted': 'Replace or recharge sensor battery immediately',
            'sudden_drop': 'Investigate potential equipment malfunction',
            'sudden_spike': 'Check for external interference or calibration issues'
        }
        return actions.get(anomaly_type, 'Investigate and monitor system')
    
    def get_health_status(self):
        """Get comprehensive health status"""
        return {
            'service_status': self.health_status['service_status'],
            'models_loaded': self.health_status['models_loaded'],
            'last_error': self.health_status['last_error'],
            'performance_metrics': {
                **self.performance_metrics,
                'error_rate': (self.performance_metrics['error_count'] / 
                             max(self.performance_metrics['prediction_count'], 1)),
                'last_check': datetime.now().isoformat()
            },
            'capabilities': {
                'rule_based_detection': True,
                'ml_detection': self.health_status['models_loaded'],
                'batch_processing': True,
                'real_time_processing': True
            }
        }
    
    def generate_alert_message(self, anomaly_results):
        """สร้างข้อความแจ้งเตือนที่อ่านง่ายพร้อม enhanced formatting"""
        try:
            if 'error' in anomaly_results:
                return {
                    'level': 'error',
                    'title': 'Detection Error',
                    'message': f"Error during anomaly detection: {anomaly_results['error']}",
                    'icon': '❌',
                    'timestamp': anomaly_results.get('timestamp', datetime.now().isoformat())
                }
            
            summary = anomaly_results.get('summary', {})
            
            if not summary.get('rule_anomalies_found') and not summary.get('ml_anomalies_found'):
                return {
                    'level': 'info',
                    'title': 'System Normal',
                    'message': 'All sensors are operating within normal parameters.',
                    'icon': '✅',
                    'confidence': summary.get('confidence_scores', {}).get('combined', 1.0),
                    'timestamp': anomaly_results['timestamp']
                }
            
            alert_level = summary.get('alert_level', 'yellow')
            recommendations = summary.get('recommendations', [])
            
            # กำหนดไอคอนและระดับความสำคัญ
            icons = {'red': '🔴', 'yellow': '⚠️', 'green': '✅'}
            levels = {'red': 'critical', 'yellow': 'warning', 'green': 'info'}
            
            icon = icons.get(alert_level, '⚠️')
            level = levels.get(alert_level, 'warning')
            
            # สร้างข้อความหลัก
            if alert_level == 'red':
                title = 'Critical System Alert'
                message = 'Immediate attention required! Critical anomalies detected.'
            elif alert_level == 'yellow':
                title = 'System Warning'
                message = 'Unusual patterns detected. Investigation recommended.'
            else:
                title = 'System Information'
                message = 'Minor variations detected in sensor readings.'
            
            # เพิ่มรายละเอียดจากคำแนะนำ
            if recommendations:
                high_priority = [r for r in recommendations if r.get('priority') == 'high']
                if high_priority:
                    message += f"\n\nCritical Issues:"
                    for rec in high_priority[:3]:  # Show top 3
                        message += f"\n• {rec.get('message', 'Unknown issue')}"
                        if rec.get('action'):
                            message += f"\n  Action: {rec['action']}"
            
            return {
                'level': level,
                'title': title,
                'message': message,
                'icon': icon,
                'confidence': summary.get('confidence_scores', {}).get('combined', 0.5),
                'priority_score': summary.get('priority_score', 0),
                'total_anomalies': summary.get('total_anomalies', 0),
                'timestamp': anomaly_results['timestamp'],
                'recommendations': recommendations[:5]  # Limit to 5 recommendations
            }
            
        except Exception as e:
            logger.error(f"❌ Error generating alert message: {e}")
            return {
                'level': 'error',
                'title': 'Alert Generation Error',
                'message': 'Failed to generate alert message',
                'icon': '❌',
                'timestamp': datetime.now().isoformat()
            }

# Enhanced SensorSimulator with more realistic data
class SensorSimulator:
    """Enhanced simulator with better anomaly generation"""
    
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
        self.anomaly_patterns = {
            'gradual_drift': {'active': False, 'start_time': None},
            'periodic_spike': {'active': False, 'phase': 0},
            'random_noise': {'level': 0.1}
        }
    
    def generate_normal_data(self, with_patterns=True):
        """สร้างข้อมูลปกติพร้อม realistic patterns"""
        data = {}
        
        for key, value in self.current_values.items():
            # Base noise
            if key in ['temperature', 'humidity']:
                noise = np.random.normal(0, 0.5)
            elif key == 'voltage':
                noise = np.random.normal(0, 0.05)
            elif key == 'battery_level':
                noise = np.random.normal(0, 1)
            else:
                noise = np.random.normal(0, value * 0.02)
            
            # Add realistic patterns
            if with_patterns:
                if key == 'temperature':
                    # Daily temperature cycle
                    hour = datetime.now().hour
                    daily_variation = 3 * np.sin((hour - 6) * np.pi / 12)
                    noise += daily_variation
                
                if key == 'battery_level':
                    # Gradual battery drain
                    drain_rate = 0.01  # 1% per call (adjust as needed)
                    self.current_values[key] = max(0, value - drain_rate)
            
            data[key] = max(0, value + noise)
        
        # คำนวณ derived values
        temp = data['temperature']
        humidity = data['humidity']
        
        if temp is not None and humidity is not None:
            # Dew point calculation
            a, b = 17.27, 237.7
            alpha = ((a * temp) / (b + temp)) + np.log(humidity / 100)
            dew_point = (b * alpha) / (a - alpha)
            
            # VPD calculation
            saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
            actual_vapor_pressure = saturation_vapor_pressure * (humidity / 100)
            vpd = saturation_vapor_pressure - actual_vapor_pressure
            
            data['dew_point'] = round(dew_point, 2)
            data['vpd'] = round(max(0, vpd), 2)
        
        data['timestamp'] = datetime.now().isoformat()
        return data
    
    def generate_anomaly_data(self, anomaly_type, severity='medium'):
        """Generate more realistic anomaly data"""
        data = self.generate_normal_data(with_patterns=False)
        
        severity_multipliers = {'low': 0.5, 'medium': 1.0, 'high': 2.0}
        multiplier = severity_multipliers.get(severity, 1.0)
        
        if anomaly_type == 'sudden_drop':
            data['temperature'] = max(0, data['temperature'] - 10 * multiplier)
            data['voltage'] = max(0, data['voltage'] - 0.8 * multiplier)
            
        elif anomaly_type == 'sudden_spike':
            data['temperature'] = min(60, data['temperature'] + 15 * multiplier)
            data['voltage'] = min(5, data['voltage'] + 0.5 * multiplier)
            
        elif anomaly_type == 'sensor_failure':
            # Simulate complete sensor failure
            data['temperature'] = None
            data['humidity'] = None
            data['voltage'] = 0
            
        elif anomaly_type == 'gradual_drift':
            # Simulate gradual sensor drift
            drift_amount = 5 * multiplier
            data['temperature'] += drift_amount
            data['humidity'] = max(0, min(100, data['humidity'] + drift_amount))
        
        # Recalculate derived values
        if data.get('temperature') is not None and data.get('humidity') is not None:
            temp, humidity = data['temperature'], data['humidity']
            a, b = 17.27, 237.7
            alpha = ((a * temp) / (b + temp)) + np.log(humidity / 100)
            data['dew_point'] = round((b * alpha) / (a - alpha), 2)
        
        return data

# ตัวอย่างการใช้งาน Enhanced API
if __name__ == "__main__":
    print("🚀 ทดสอบ Enhanced Anomaly Detection API")
    print("=" * 60)
    
    # สร้าง API instance
    api = AnomalyDetectionAPI()
    
    # ตรวจสอบ health status
    health = api.get_health_status()
    print(f"\n📊 System Health: {health['service_status']}")
    print(f"🤖 ML Models: {'✅ Loaded' if health['models_loaded'] else '❌ Not Available'}")
    
    # สร้างตัวจำลองข้อมูล
    simulator = SensorSimulator()
    
    # ทดสอบข้อมูลปกติ
    print("\n🔍 ทดสอบข้อมูลปกติ:")
    normal_data = simulator.generate_normal_data()
    print(f"📊 Temperature: {normal_data['temperature']:.1f}°C")
    print(f"📊 Humidity: {normal_data['humidity']:.1f}%")
    print(f"📊 Voltage: {normal_data['voltage']:.2f}V")
    
    results = api.detect_anomalies_hybrid([normal_data])
    alert = api.generate_alert_message(results)
    print(f"\n{alert['icon']} {alert['title']}")
    print(f"📈 Confidence: {alert.get('confidence', 0):.2f}")
    
    # ทดสอบข้อมูลผิดปกติ
    print("\n" + "="*60)
    print("⚠️ ทดสอบการตรวจจับ anomalies:")
    
    anomaly_types = ['sudden_drop', 'sudden_spike', 'sensor_failure']
    
    for anomaly_type in anomaly_types:
        print(f"\n🧪 ทดสอบ {anomaly_type}:")
        anomaly_data = simulator.generate_anomaly_data(anomaly_type, severity='high')
        
        results = api.detect_anomalies_hybrid([anomaly_data])
        alert = api.generate_alert_message(results)
        
        print(f"{alert['icon']} {alert['title']} (Confidence: {alert.get('confidence', 0):.2f})")
        if alert.get('recommendations'):
            for rec in alert['recommendations'][:2]:
                print(f"  💡 {rec.get('action', 'No action specified')}")
    
    # แสดง final health status
    final_health = api.get_health_status()
    print(f"\n📊 Final Statistics:")
    print(f"  Predictions: {final_health['performance_metrics']['prediction_count']}")
    print(f"  Errors: {final_health['performance_metrics']['error_count']}")
    print(f"  Avg Response Time: {final_health['performance_metrics']['average_response_time']:.3f}s")
    
    print("\n✅ Enhanced API testing completed!")