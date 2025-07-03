import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.svm import OneClassSVM
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import os
import warnings
warnings.filterwarnings('ignore')

class AnomalyDetectionModels:
    """คลาสสำหรับโมเดล Machine Learning ตรวจจับความผิดปกติ"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_columns = [
            'temperature', 'humidity', 'co2', 'ec', 'ph', 
            'dew_point', 'vpd', 'voltage', 'battery_level'
        ]
        self.time_features = ['hour', 'day_of_week', 'month']
        
    def prepare_data(self, df):
        """เตรียมข้อมูลสำหรับการเทรน"""
        print("🔧 เตรียมข้อมูล...")
        
        df_clean = df.copy()
        
        # แปลง timestamp เป็น datetime
        df_clean['timestamp'] = pd.to_datetime(df_clean['timestamp'])
        
        # สร้าง time features
        df_clean['hour'] = df_clean['timestamp'].dt.hour
        df_clean['day_of_week'] = df_clean['timestamp'].dt.dayofweek
        df_clean['month'] = df_clean['timestamp'].dt.month
        
        # จัดการค่า null (สร้าง indicator variables)
        for col in self.feature_columns:
            df_clean[f'{col}_is_missing'] = df_clean[col].isnull().astype(int)
        
        # เติมค่า null ด้วยค่าเฉลี่ย
        df_clean[self.feature_columns] = df_clean[self.feature_columns].fillna(
            df_clean[self.feature_columns].mean()
        )
        
        # รวม features ทั้งหมด
        missing_cols = [f'{col}_is_missing' for col in self.feature_columns]
        all_features = self.feature_columns + self.time_features + missing_cols
        
        print(f"✅ เตรียมข้อมูลเสร็จ: {len(all_features)} features")
        return df_clean, all_features
    
    def train_isolation_forest(self, X_train, y_train):
        """เทรนโมเดล Isolation Forest"""
        print("🌲 เทรน Isolation Forest...")
        
        # ใช้เฉพาะข้อมูลปกติในการเทรน
        X_normal = X_train[y_train == 0]
        
        # Scale ข้อมูล
        scaler = RobustScaler()
        X_normal_scaled = scaler.fit_transform(X_normal)
        
        # เทรนโมเดล
        model = IsolationForest(
            contamination=0.1,      # คาดหวัง 10% anomaly
            random_state=42,
            n_estimators=100,
            max_samples='auto'
        )
        model.fit(X_normal_scaled)
        
        # เก็บโมเดลและ scaler
        self.models['isolation_forest'] = model
        self.scalers['isolation_forest'] = scaler
        
        print("✅ เทรน Isolation Forest เสร็จสิ้น")
        return model, scaler
    
    def train_one_class_svm(self, X_train, y_train):
        """เทรนโมเดล One-Class SVM"""
        print("⚙️ เทรน One-Class SVM...")
        
        # ใช้เฉพาะข้อมูลปกติในการเทรน
        X_normal = X_train[y_train == 0]
        
        # Scale ข้อมูล
        scaler = StandardScaler()
        X_normal_scaled = scaler.fit_transform(X_normal)
        
        # เทรนโมเดล
        model = OneClassSVM(
            kernel='rbf',
            gamma='scale',
            nu=0.1  # คาดหวัง 10% anomaly
        )
        model.fit(X_normal_scaled)
        
        # เก็บโมเดลและ scaler
        self.models['one_class_svm'] = model
        self.scalers['one_class_svm'] = scaler
        
        print("✅ เทรน One-Class SVM เสร็จสิ้น")
        return model, scaler
    
    def train_ensemble_model(self, X_train, y_train):
        """เทรนโมเดลแบบ Ensemble (รวม Isolation Forest + One-Class SVM)"""
        print("🎯 เทรน Ensemble Model...")
        
        # เทรนโมเดลแต่ละตัว
        if_model, if_scaler = self.train_isolation_forest(X_train, y_train)
        svm_model, svm_scaler = self.train_one_class_svm(X_train, y_train)
        
        # เก็บโมเดล ensemble
        ensemble_models = {
            'isolation_forest': if_model,
            'one_class_svm': svm_model
        }
        ensemble_scalers = {
            'isolation_forest': if_scaler,
            'one_class_svm': svm_scaler
        }
        
        self.models['ensemble'] = ensemble_models
        self.scalers['ensemble'] = ensemble_scalers
        
        print("✅ เทรน Ensemble Model เสร็จสิ้น")
        return ensemble_models, ensemble_scalers
    
    def predict_anomalies(self, X_test, model_name='ensemble'):
        """ทำนายความผิดปกติ"""
        if model_name == 'ensemble':
            return self._predict_ensemble(X_test)
        else:
            model = self.models[model_name]
            scaler = self.scalers[model_name]
            X_test_scaled = scaler.transform(X_test)
            predictions = model.predict(X_test_scaled)
            # แปลง (-1 = anomaly, 1 = normal) เป็น (1 = anomaly, 0 = normal)
            return (predictions == -1).astype(int)
    
    def _predict_ensemble(self, X_test):
        """ทำนายด้วยโมเดล Ensemble"""
        models = self.models['ensemble']
        scalers = self.scalers['ensemble']
        
        predictions = []
        
        # Isolation Forest
        if_scaler = scalers['isolation_forest']
        if_model = models['isolation_forest']
        X_test_if = if_scaler.transform(X_test)
        if_pred = (if_model.predict(X_test_if) == -1).astype(int)
        predictions.append(if_pred)
        
        # One-Class SVM
        svm_scaler = scalers['one_class_svm']
        svm_model = models['one_class_svm']
        X_test_svm = svm_scaler.transform(X_test)
        svm_pred = (svm_model.predict(X_test_svm) == -1).astype(int)
        predictions.append(svm_pred)
        
        # Voting: ถ้าโมเดลใดโมเดลหนึ่งบอกว่าเป็น anomaly
        ensemble_pred = np.array(predictions).sum(axis=0) >= 1
        
        return ensemble_pred.astype(int)
    
    def evaluate_model(self, X_test, y_test, model_name='ensemble'):
        """ประเมินผลโมเดล"""
        print(f"📊 ประเมินผลโมเดล {model_name}...")
        
        y_pred = self.predict_anomalies(X_test, model_name)
        
        # Classification Report
        print("\n📈 Classification Report:")
        print(classification_report(y_test, y_pred))
        
        # Confusion Matrix
        cm = confusion_matrix(y_test, y_pred)
        print("\n🔍 Confusion Matrix:")
        print(cm)
        
        # ROC AUC Score
        if len(np.unique(y_test)) > 1:
            auc_score = roc_auc_score(y_test, y_pred)
            print(f"\n🎯 ROC AUC Score: {auc_score:.4f}")
        
        return {
            'predictions': y_pred,
            'true_labels': y_test,
            'confusion_matrix': cm,
            'classification_report': classification_report(y_test, y_pred, output_dict=True)
        }
    
    def save_models(self, filepath_prefix="models/anomaly_detection"):
        """บันทึกโมเดล"""
        print("💾 บันทึกโมเดล...")
        
        # สร้างโฟลเดอร์ models ถ้ายังไม่มี
        os.makedirs("models", exist_ok=True)
        
        # บันทึกโมเดลแต่ละตัว
        for model_name, model in self.models.items():
            joblib.dump(model, f"{filepath_prefix}_{model_name}.pkl")
        
        # บันทึก scalers
        joblib.dump(self.scalers, f"{filepath_prefix}_scalers.pkl")
        
        print("✅ บันทึกโมเดลเสร็จสิ้น")
    
    def load_models(self, filepath_prefix="models/anomaly_detection"):
        """โหลดโมเดล"""
        print("📥 โหลดโมเดล...")
        
        try:
            # โหลด scalers
            self.scalers = joblib.load(f"{filepath_prefix}_scalers.pkl")
            
            # โหลดโมเดลแต่ละตัว
            for model_name in ['isolation_forest', 'one_class_svm', 'ensemble']:
                try:
                    self.models[model_name] = joblib.load(f"{filepath_prefix}_{model_name}.pkl")
                except FileNotFoundError:
                    print(f"⚠️ ไม่พบไฟล์ {model_name} model")
            
            print("✅ โหลดโมเดลเสร็จสิ้น")
            
        except FileNotFoundError:
            print("❌ ไม่พบไฟล์โมเดล")

class RuleBasedAnomalyDetector:
    """โมเดลตรวจจับความผิดปกติตามกฎที่กำหนด"""
    
    def __init__(self):
        # กฎการตรวจจับตามตารางที่คุณให้มา
        self.rules = {
            'sudden_drop': {
                'condition': self._check_sudden_drop,
                'alert_level': 'red',
                'message': "Abnormal sensor behavior detected. Value dropped faster than expected."
            },
            'sudden_spike': {
                'condition': self._check_sudden_spike,
                'alert_level': 'yellow',
                'message': "Abnormally high sensor reading. Please check."
            },
            'vpd_too_low': {
                'condition': self._check_vpd_too_low,
                'alert_level': 'red',
                'message': "VPD too low! Risk of plant disease. Check ventilation system."
            },
            'low_voltage': {
                'condition': self._check_low_voltage,
                'alert_level': 'yellow',
                'message': "Voltage instability alert. Please check electrical system."
            },
            'dew_point_close': {
                'condition': self._check_dew_point_close,
                'alert_level': 'red',
                'message': "Dew Point close to actual temperature. Risk of mold."
            },
            'battery_depleted': {
                'condition': self._check_battery_depleted,
                'alert_level': 'red',
                'message': "Sensor battery depleted. Please replace or recharge."
            }
        }
    
    def _check_sudden_drop(self, current_data, previous_data):
        """ตรวจสอบการลดลงอย่างรวดเร็ว"""
        if previous_data is None:
            return False
        
        # อุณหภูมิลดลง > 5°C ใน 10 นาที
        if (current_data.get('temperature') is not None and 
            previous_data.get('temperature') is not None):
            temp_diff = previous_data['temperature'] - current_data['temperature']
            if temp_diff > 5:
                return True
        
        # Voltage ลดลงต่ำกว่า 2.8V
        if current_data.get('voltage') is not None and current_data['voltage'] < 2.8:
            return True
        
        return False
    
    def _check_sudden_spike(self, current_data, previous_data):
        """ตรวจสอบการเพิ่มขึ้นอย่างรวดเร็ว"""
        if previous_data is None:
            return False
        
        # อุณหภูมิเพิ่มขึ้น > 5°C ใน 10 นาที
        if (current_data.get('temperature') is not None and 
            previous_data.get('temperature') is not None):
            temp_diff = current_data['temperature'] - previous_data['temperature']
            if temp_diff > 5:
                return True
        
        # Voltage สูงกว่า 3.5V
        if current_data.get('voltage') is not None and current_data['voltage'] > 3.5:
            return True
        
        return False
    
    def _check_vpd_too_low(self, current_data, previous_data):
        """ตรวจสอบ VPD ต่ำเกินไป"""
        if current_data.get('vpd') is not None and current_data['vpd'] < 0.5:
            return True
        return False
    
    def _check_low_voltage(self, current_data, previous_data):
        """ตรวจสอบ voltage ต่ำ"""
        if current_data.get('voltage') is not None:
            # Voltage ต่ำกว่า 3.0V
            if current_data['voltage'] < 3.0:
                return True
            
            # Voltage ผันผวนมาก
            if previous_data and previous_data.get('voltage') is not None:
                voltage_diff = abs(current_data['voltage'] - previous_data['voltage'])
                if voltage_diff > 0.5:
                    return True
        
        return False
    
    def _check_dew_point_close(self, current_data, previous_data):
        """ตรวจสอบ Dew Point ใกล้อุณหภูมิจริง"""
        if (current_data.get('temperature') is not None and 
            current_data.get('dew_point') is not None):
            temp_diff = current_data['temperature'] - current_data['dew_point']
            if temp_diff < 2:  # ต่างกันน้อยกว่า 2°C
                return True
        return False
    
    def _check_battery_depleted(self, current_data, previous_data):
        """ตรวจสอบแบตเตอรี่หมด"""
        if current_data.get('battery_level') is not None and current_data['battery_level'] < 10:
            return True
        if current_data.get('voltage') is not None and current_data['voltage'] < 2.0:
            return True
        return False
    
    def detect_anomalies(self, data_stream):
        """ตรวจจับความผิดปกติจากข้อมูลปัจจุบัน"""
        anomalies = []
        
        current_data = data_stream[-1] if isinstance(data_stream, list) else data_stream
        previous_data = data_stream[-2] if isinstance(data_stream, list) and len(data_stream) > 1 else None
        
        for rule_name, rule_config in self.rules.items():
            is_anomaly = rule_config['condition'](current_data, previous_data)
            
            if is_anomaly:
                anomalies.append({
                    'type': rule_name,
                    'alert_level': rule_config['alert_level'],
                    'message': rule_config['message'],
                    'timestamp': current_data.get('timestamp', datetime.now().isoformat()),
                    'data': current_data
                })
        
        return anomalies

# ทดสอบการทำงาน
if __name__ == "__main__":
    print("🧪 ทดสอบโมเดลตรวจจับความผิดปกติ...")
    
    # ทดสอบ Rule-based Detector
    print("\n🔍 ทดสอบ Rule-based Detection...")
    rule_detector = RuleBasedAnomalyDetector()
    
    # ข้อมูลทดสอบ
    test_data = [
        {
            'temperature': 25.0,
            'humidity': 95.0,
            'vpd': 0.3,  # VPD ต่ำ
            'dew_point': 24.5,  # ใกล้กับอุณหภูมิ
            'voltage': 2.5,  # Voltage ต่ำ
            'battery_level': 5,  # แบตต่ำ
            'timestamp': '2024-01-01T12:00:00'
        }
    ]
    
    anomalies = rule_detector.detect_anomalies(test_data)
    
    if anomalies:
        print("⚠️ พบความผิดปกติ:")
        for anomaly in anomalies:
            print(f"  - {anomaly['type']}: {anomaly['message']}")
            print(f"    Alert Level: {anomaly['alert_level']}")
    else:
        print("✅ ไม่พบความผิดปกติ")
    
    print("\n✅ ทดสอบเสร็จสิ้น!")
    print("📝 ใช้คำสั่ง: python anomaly_models.py")