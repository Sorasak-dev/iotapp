import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, RobustScaler, PowerTransformer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, precision_recall_curve
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor
from sklearn.covariance import EllipticEnvelope
from sklearn.utils import resample
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import os
import warnings
import logging
from typing import Dict, List, Optional, Union, Tuple
from collections import defaultdict

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

class FeatureManager:
    """จัดการ Feature alignment และ version control"""
    
    def __init__(self, target_features=49):
        self.target_features = target_features
        self.feature_info = None
        self.feature_version = "2.1"
        
    def save_feature_info(self, feature_names, feature_count, version="2.1"):
        """บันทึกข้อมูล features สำหรับใช้ใน inference"""
        self.feature_info = {
            'feature_names': feature_names,
            'expected_features': feature_count,
            'version': version,
            'created_at': datetime.now().isoformat()
        }
        return self.feature_info
    
    def align_features(self, X, method='pad_zeros'):
        """จัดการ feature dimension mismatch"""
        if X is None or len(X.shape) != 2:
            logger.error("Invalid input for feature alignment")
            return X
        
        current_features = X.shape[1]
        
        if current_features == self.target_features:
            return X
        
        logger.warning(f"Feature mismatch: {current_features} vs {self.target_features}")
        
        if current_features < self.target_features:
            # เพิ่ม features ด้วยการ pad zeros หรือ mean
            missing_count = self.target_features - current_features
            
            if method == 'pad_zeros':
                padding = np.zeros((X.shape[0], missing_count))
            elif method == 'pad_mean':
                mean_values = np.mean(X, axis=0)
                padding = np.tile(mean_values[:min(len(mean_values), missing_count)], 
                                (X.shape[0], 1))
                if padding.shape[1] < missing_count:
                    additional = np.zeros((X.shape[0], missing_count - padding.shape[1]))
                    padding = np.concatenate([padding, additional], axis=1)
            else:
                padding = np.zeros((X.shape[0], missing_count))
            
            X_aligned = np.concatenate([X, padding], axis=1)
            logger.info(f"Added {missing_count} features via {method}")
            
        else:  # current_features > self.target_features
            # ตัด features ส่วนเกิน
            X_aligned = X[:, :self.target_features]
            removed_count = current_features - self.target_features
            logger.info(f"Removed {removed_count} excess features")
        
        return X_aligned

class AnomalyDetectionModels:
    """โมเดล ML สำหรับ anomaly detection ประสิทธิภาพสูง v2.1 - Fixed"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_importances = {}
        self.model_performance = {}
        self.feature_manager = FeatureManager(target_features=49)
        
        # Features หลัก - Fixed order
        self.feature_columns = [
            'temperature', 'humidity', 'co2', 'ec', 'ph', 
            'dew_point', 'vpd', 'voltage', 'battery_level'
        ]
        self.time_features = ['hour', 'day_of_week', 'month', 'is_night', 'is_weekend']
        self.derived_features = []
        
        # Configuration
        self.model_config = {
            'isolation_forest': {
                'contamination': 0.15,
                'n_estimators': 300,  # Reduced for stability
                'max_samples': 0.65,
                'max_features': 0.75,
                'random_state': 42
            },
            'one_class_svm': {
                'kernel': 'rbf',
                'gamma': 'scale',
                'nu': 0.12,
                'shrinking': True
            },
            'local_outlier_factor': {
                'n_neighbors': 25,
                'contamination': 0.15,
                'novelty': True,
                'algorithm': 'auto'
            },
            'elliptic_envelope': {
                'contamination': 0.15,
                'random_state': 42,
                'support_fraction': None
            }
        }
        
        # สำหรับ ensemble
        self.ensemble_weights = {
            'isolation_forest': 0.30,
            'one_class_svm': 0.28,
            'local_outlier_factor': 0.25,
            'elliptic_envelope': 0.17
        }
    
    def create_advanced_features_fixed(self, df):
        """สร้าง Features ขั้นสูงแบบ Fixed Version - ต้องได้ 49 features เสมอ"""
        logger.info("สร้าง advanced features v2.1 (Fixed)...")
        
        df_enhanced = df.copy()
        self.derived_features = []
        
        try:
            # 1. Rolling Statistics (12 features)
            rolling_cols = ['temperature', 'humidity', 'voltage', 'battery_level']
            for col in rolling_cols:
                if col in df_enhanced.columns:
                    window_size = min(5, len(df_enhanced))
                    
                    rolling_data = df_enhanced[col].rolling(
                        window=window_size, 
                        min_periods=1, 
                        center=False
                    )
                    
                    df_enhanced[f'{col}_rolling_mean'] = rolling_data.mean()
                    df_enhanced[f'{col}_rolling_std'] = rolling_data.std().fillna(0)
                    df_enhanced[f'{col}_rolling_range'] = (
                        rolling_data.max() - rolling_data.min()
                    ).fillna(0)
                    
                    self.derived_features.extend([
                        f'{col}_rolling_mean', 
                        f'{col}_rolling_std', 
                        f'{col}_rolling_range'
                    ])
            
            # 2. Ratio Features (4 features)
            if 'temperature' in df_enhanced.columns and 'humidity' in df_enhanced.columns:
                safe_humidity = df_enhanced['humidity'].replace(0, 0.1)
                df_enhanced['temp_humidity_ratio'] = (
                    df_enhanced['temperature'] / safe_humidity
                ).replace([np.inf, -np.inf], 0)
                self.derived_features.append('temp_humidity_ratio')
            
            if 'voltage' in df_enhanced.columns and 'battery_level' in df_enhanced.columns:
                safe_battery = df_enhanced['battery_level'].replace(0, 0.1)
                df_enhanced['voltage_battery_ratio'] = (
                    df_enhanced['voltage'] / safe_battery
                ).replace([np.inf, -np.inf], 0)
                self.derived_features.append('voltage_battery_ratio')
            
            if 'vpd' in df_enhanced.columns and 'humidity' in df_enhanced.columns:
                safe_vpd = np.clip(df_enhanced['vpd'], 0, 15)
                df_enhanced['vpd_humidity_interaction'] = (
                    safe_vpd * df_enhanced['humidity'] / 100
                ).replace([np.inf, -np.inf], 0)
                self.derived_features.append('vpd_humidity_interaction')
            
            if 'ec' in df_enhanced.columns and 'ph' in df_enhanced.columns:
                df_enhanced['ec_ph_interaction'] = (
                    df_enhanced['ec'] * df_enhanced['ph']
                ).replace([np.inf, -np.inf], 0)
                self.derived_features.append('ec_ph_interaction')
            
            # 3. Difference Features (4 features)
            diff_cols = ['temperature', 'humidity', 'voltage', 'co2']
            for col in diff_cols:
                if col in df_enhanced.columns:
                    df_enhanced[f'{col}_diff'] = df_enhanced[col].diff().fillna(0)
                    df_enhanced[f'{col}_diff'] = np.clip(
                        df_enhanced[f'{col}_diff'], -100, 100
                    )
                    self.derived_features.append(f'{col}_diff')
            
            # 4. Statistical Features (4 features)
            sensor_cols = ['temperature', 'humidity', 'voltage', 'co2']
            available_cols = [col for col in sensor_cols if col in df_enhanced.columns]
            
            if len(available_cols) >= 2:
                for i, col in enumerate(available_cols[:4]):  # จำกัดเป็น 4 features
                    col_data = df_enhanced[col].values
                    if len(col_data) > 1:
                        std_val = np.std(col_data)
                        if std_val > 0:
                            z_scores = (col_data - np.mean(col_data)) / std_val
                            df_enhanced[f'{col}_zscore'] = np.clip(z_scores, -5, 5)
                            self.derived_features.append(f'{col}_zscore')
            
            # 5. Binned Features (2 features)
            if 'temperature' in df_enhanced.columns:
                temp_data = df_enhanced['temperature'].replace([np.inf, -np.inf], np.nan)
                temp_data = temp_data.fillna(temp_data.median())
                
                try:
                    df_enhanced['temp_category'] = pd.cut(
                        temp_data,
                        bins=[-np.inf, 15, 25, 35, np.inf],
                        labels=[0, 1, 2, 3],
                        include_lowest=True
                    ).astype(float)
                    self.derived_features.append('temp_category')
                except Exception:
                    df_enhanced['temp_category'] = 1
                    self.derived_features.append('temp_category')
            
            if 'humidity' in df_enhanced.columns:
                humidity_data = df_enhanced['humidity'].replace([np.inf, -np.inf], np.nan)
                humidity_data = humidity_data.fillna(humidity_data.median())
                
                try:
                    df_enhanced['humidity_category'] = pd.cut(
                        humidity_data,
                        bins=[0, 40, 70, 90, 100],
                        labels=[0, 1, 2, 3],
                        include_lowest=True
                    ).astype(float)
                    self.derived_features.append('humidity_category')
                except Exception:
                    df_enhanced['humidity_category'] = 1
                    self.derived_features.append('humidity_category')
            
            # 6. Environmental Stress และ Power Health (2 features)
            if all(col in df_enhanced.columns for col in ['vpd', 'dew_point', 'temperature']):
                safe_vpd = np.clip(df_enhanced['vpd'].fillna(1.0), 0, 15)
                safe_dew_point = df_enhanced['dew_point'].fillna(18.0)
                safe_temperature = df_enhanced['temperature'].fillna(25.0)
                
                stress_score = 0
                stress_score += (safe_vpd < 0.4).astype(int)
                stress_score += (safe_dew_point > safe_temperature - 2).astype(int)
                stress_score += (safe_temperature > 38).astype(int)
                stress_score += (safe_temperature < 12).astype(int)
                
                df_enhanced['environmental_stress'] = np.clip(stress_score, 0, 4)
                self.derived_features.append('environmental_stress')
            
            if all(col in df_enhanced.columns for col in ['voltage', 'battery_level']):
                voltage_health = (df_enhanced['voltage'] > 3.0).astype(int)
                battery_health = (df_enhanced['battery_level'] > 20).astype(int)
                df_enhanced['power_health'] = voltage_health + battery_health
                self.derived_features.append('power_health')
            
            # 7. Missing indicators (9 features สำหรับ sensor หลัก)
            missing_features = []
            for col in self.feature_columns:
                if col in df_enhanced.columns:
                    missing_col = f'{col}_is_missing'
                    df_enhanced[missing_col] = df_enhanced[col].isnull().astype(int)
                    missing_features.append(missing_col)
            
            self.derived_features.extend(missing_features)
            
            # 8. ตรวจสอบและปรับจำนวน features ให้ตรง 49
            total_base_features = len(self.feature_columns) + len(self.time_features)  # 9 + 5 = 14
            current_derived = len(self.derived_features)
            expected_derived = 49 - total_base_features  # 49 - 14 = 35
            
            if current_derived < expected_derived:
                # เพิ่ม features ที่ขาดหายไป
                needed = expected_derived - current_derived
                logger.warning(f"Adding {needed} additional features to reach target")
                
                # สร้าง polynomial features
                if 'temperature' in df_enhanced.columns:
                    df_enhanced['temp_squared'] = df_enhanced['temperature'] ** 2
                    self.derived_features.append('temp_squared')
                    needed -= 1
                
                if needed > 0 and 'humidity' in df_enhanced.columns:
                    df_enhanced['humidity_squared'] = df_enhanced['humidity'] ** 2
                    self.derived_features.append('humidity_squared')
                    needed -= 1
                
                # เพิ่ม synthetic features ถ้าจำเป็น
                for i in range(needed):
                    feature_name = f'synthetic_feature_{i}'
                    df_enhanced[feature_name] = np.random.normal(0, 0.01, len(df_enhanced))
                    self.derived_features.append(feature_name)
            
            elif current_derived > expected_derived:
                # ลด features ส่วนเกิน
                excess = current_derived - expected_derived
                logger.warning(f"Removing {excess} excess features")
                self.derived_features = self.derived_features[:expected_derived]
            
            # ทำความสะอาด derived features
            for feature in self.derived_features:
                if feature in df_enhanced.columns:
                    df_enhanced[feature] = df_enhanced[feature].replace(
                        [np.inf, -np.inf], 0
                    ).fillna(0)
                    
                    if df_enhanced[feature].dtype in ['float64', 'float32']:
                        df_enhanced[feature] = np.clip(df_enhanced[feature], -1000, 1000)
                else:
                    # สร้าง feature ที่หายไป
                    df_enhanced[feature] = 0
        
        except Exception as e:
            logger.error(f"Error in create_advanced_features_fixed: {e}")
            # สร้าง minimal derived features
            needed_features = 35  # 49 - 14 = 35
            self.derived_features = []
            for i in range(needed_features):
                feature_name = f'default_feature_{i}'
                df_enhanced[feature_name] = 0
                self.derived_features.append(feature_name)
        
        final_derived_count = len(self.derived_features)
        logger.info(f"สร้าง {final_derived_count} advanced features เสร็จสิ้น")
        
        return df_enhanced
    
    def prepare_data_enhanced_fixed(self, df):
        """เตรียมข้อมูลแบบขั้นสูง - Fixed Version รับประกัน 49 features"""
        logger.info("เตรียมข้อมูลแบบขั้นสูง v2.1 (Fixed)...")
        
        df_clean = df.copy()
        
        try:
            # แปลง timestamp และสร้าง time features
            if 'timestamp' in df_clean.columns:
                df_clean['timestamp'] = pd.to_datetime(df_clean['timestamp'], errors='coerce')
                
                df_clean['hour'] = df_clean['timestamp'].dt.hour
                df_clean['day_of_week'] = df_clean['timestamp'].dt.dayofweek
                df_clean['month'] = df_clean['timestamp'].dt.month
                df_clean['is_night'] = ((df_clean['hour'] >= 22) | (df_clean['hour'] <= 6)).astype(int)
                df_clean['is_weekend'] = (df_clean['day_of_week'] >= 5).astype(int)
            else:
                now = datetime.now()
                df_clean['hour'] = now.hour
                df_clean['day_of_week'] = now.weekday()
                df_clean['month'] = now.month
                df_clean['is_night'] = ((df_clean['hour'] >= 22) | (df_clean['hour'] <= 6)).astype(int)
                df_clean['is_weekend'] = (df_clean['day_of_week'] >= 5).astype(int)
            
            # สร้างคอลัมน์ sensor ที่หายไป
            for col in self.feature_columns:
                if col not in df_clean.columns:
                    # ใช้ค่า default ที่เหมาะสม
                    default_values = {
                        'temperature': 25.0, 'humidity': 65.0, 'voltage': 3.3,
                        'battery_level': 80.0, 'co2': 800.0, 'ec': 1.5,
                        'ph': 6.5, 'dew_point': 18.0, 'vpd': 1.0
                    }
                    df_clean[col] = default_values.get(col, 0)
            
            # ทำความสะอาดข้อมูลเซนเซอร์
            numeric_cols = self.feature_columns
            error_codes = [-999, -1, 9999]
            
            for col in numeric_cols:
                if col in df_clean.columns:
                    # แทนที่ error codes ด้วย NaN สำหรับข้อมูลปกติ
                    if 'is_anomaly' in df_clean.columns:
                        for error_code in error_codes:
                            normal_mask = (df_clean['is_anomaly'] == 0) & (df_clean[col] == error_code)
                            df_clean.loc[normal_mask, col] = np.nan
                    
                    # จำกัดค่าให้อยู่ในช่วงสมเหตุสมผล (เฉพาะข้อมูลปกติ)
                    if 'is_anomaly' in df_clean.columns:
                        normal_mask = df_clean['is_anomaly'] == 0
                        
                        if col == 'temperature':
                            df_clean.loc[normal_mask, col] = df_clean.loc[normal_mask, col].apply(
                                lambda x: np.clip(x, -30, 70) if pd.notnull(x) else np.nan
                            )
                        elif col == 'humidity':
                            df_clean.loc[normal_mask, col] = df_clean.loc[normal_mask, col].apply(
                                lambda x: np.clip(x, 0, 100) if pd.notnull(x) else np.nan
                            )
                        elif col == 'voltage':
                            df_clean.loc[normal_mask, col] = df_clean.loc[normal_mask, col].apply(
                                lambda x: np.clip(x, 0, 5) if pd.notnull(x) else np.nan
                            )
                        elif col == 'vpd':
                            df_clean[col] = df_clean[col].apply(
                                lambda x: np.clip(x, 0, 15) if pd.notnull(x) else np.nan
                            )
            
            # สร้าง advanced features
            df_clean = self.create_advanced_features_fixed(df_clean)
            
            # เติมค่าที่หายไปด้วยวิธี intelligent
            for col in self.feature_columns:
                if col in df_clean.columns:
                    if 'is_anomaly' in df_clean.columns:
                        normal_median = df_clean[df_clean['is_anomaly'] == 0][col].median()
                    else:
                        normal_median = df_clean[col].median()
                    
                    if pd.isna(normal_median):
                        fallback_values = {
                            'temperature': 25.0, 'humidity': 65.0, 'voltage': 3.3,
                            'battery_level': 80.0, 'co2': 800.0, 'ec': 1.5,
                            'ph': 6.5, 'dew_point': 18.0, 'vpd': 1.0
                        }
                        normal_median = fallback_values.get(col, 0)
                    
                    df_clean[col] = df_clean[col].fillna(normal_median)
            
            # เติมค่าที่หายไปสำหรับ derived features
            for col in self.derived_features:
                if col in df_clean.columns:
                    df_clean[col] = df_clean[col].fillna(0)
                else:
                    df_clean[col] = 0
            
            # รวม features ทั้งหมดตามลำดับที่แน่นอน
            all_features = (self.feature_columns + self.time_features + self.derived_features)
            
            # สร้างคอลัมน์ที่หายไป
            for feature in all_features:
                if feature not in df_clean.columns:
                    df_clean[feature] = 0
            
            # ตรวจสอบจำนวน features
            final_features = [f for f in all_features if f in df_clean.columns]
            expected_count = 49
            
            if len(final_features) != expected_count:
                logger.warning(f"Feature count mismatch: {len(final_features)} vs {expected_count}")
                
                # ปรับให้ตรง 49 features
                if len(final_features) < expected_count:
                    # เพิ่ม features
                    needed = expected_count - len(final_features)
                    for i in range(needed):
                        extra_feature = f'padding_feature_{i}'
                        df_clean[extra_feature] = 0
                        final_features.append(extra_feature)
                elif len(final_features) > expected_count:
                    # ตัด features ส่วนเกิน
                    final_features = final_features[:expected_count]
            
            # บันทึกข้อมูล feature สำหรับใช้ใน inference
            self.feature_manager.save_feature_info(
                feature_names=final_features,
                feature_count=len(final_features),
                version="2.1"
            )
            
            logger.info(f"เตรียมข้อมูลเสร็จสิ้น: {len(final_features)} features (ตรงตาม target)")
            return df_clean, final_features
            
        except Exception as e:
            logger.error(f"Error in prepare_data_enhanced_fixed: {e}")
            # Return minimal safe preparation with exact 49 features
            basic_features = self.feature_columns + self.time_features
            
            # เพิ่ม features ให้ครบ 49
            needed = 49 - len(basic_features)
            for i in range(needed):
                basic_features.append(f'fallback_feature_{i}')
                df_clean[f'fallback_feature_{i}'] = 0
            
            return df_clean, basic_features
    
    def clean_data_for_training(self, X):
        """ทำความสะอาดข้อมูลป้องกัน infinity และ NaN - พร้อม Feature Alignment"""
        if not isinstance(X, np.ndarray):
            X = np.array(X)
        
        X_clean = X.copy()
        
        # แทนที่ infinity และ extreme values
        X_clean = np.where(np.isinf(X_clean), 0, X_clean)
        X_clean = np.where(np.isnan(X_clean), 0, X_clean)
        
        # จำกัดค่าให้อยู่ในช่วงปลอดภัย
        safe_max = 1000
        X_clean = np.clip(X_clean, -safe_max, safe_max)
        
        # Feature alignment ก่อน return
        X_aligned = self.feature_manager.align_features(X_clean, method='pad_zeros')
        
        # แปลงเป็น float32 เพื่อประสิทธิภาพ
        try:
            X_aligned = X_aligned.astype(np.float32)
        except (ValueError, OverflowError):
            X_aligned = np.clip(X_aligned, -1e6, 1e6).astype(np.float32)
        
        return X_aligned
    
    def predict_anomalies(self, X_test, model_name='ensemble'):
        """ทำนายความผิดปกติแบบขั้นสูง - พร้อม Feature Alignment"""
        # ทำความสะอาดและ align features
        X_test_clean = self.clean_data_for_training(X_test)
        
        if model_name == 'ensemble':
            return self._predict_ensemble(X_test_clean)
        else:
            if model_name not in self.models:
                raise ValueError(f"โมเดล {model_name} ยังไม่ได้เทรน")
            
            model = self.models[model_name]
            scaler = self.scalers[model_name]
            
            try:
                X_test_scaled = scaler.transform(X_test_clean)
                predictions = model.predict(X_test_scaled)
                return (predictions == -1).astype(int)
            except Exception as e:
                logger.error(f"Error in predict_anomalies for {model_name}: {e}")
                return np.zeros(len(X_test_clean))
    
    def _predict_ensemble(self, X_test):
        """ทำนายด้วย Advanced Ensemble Model - พร้อม Feature Alignment"""
        if 'ensemble' not in self.models:
            raise ValueError("Ensemble model ยังไม่ได้เทรน")
        
        models = self.models['ensemble']
        scalers = self.scalers['ensemble']
        
        if not models:
            raise ValueError("ไม่มีโมเดลใน ensemble")
        
        ensemble_predictions = np.zeros(len(X_test))
        successful_predictions = 0
        
        for model_name, weight in self.ensemble_weights.items():
            if model_name in models and model_name in scalers:
                try:
                    scaler = scalers[model_name]
                    model = models[model_name]
                    
                    # Ensure feature alignment before scaling
                    X_test_aligned = self.feature_manager.align_features(X_test, method='pad_zeros')
                    X_test_scaled = scaler.transform(X_test_aligned)
                    predictions = (model.predict(X_test_scaled) == -1).astype(int)
                    
                    ensemble_predictions += predictions * weight
                    successful_predictions += 1
                    
                except Exception as e:
                    logger.warning(f"Error in ensemble prediction for {model_name}: {e}")
                    continue
        
        if successful_predictions == 0:
            logger.error("ไม่สามารถใช้โมเดลใดๆ ใน ensemble ได้")
            return np.zeros(len(X_test))
        
        threshold = 0.3 if successful_predictions >= 3 else 0.4
        final_predictions = (ensemble_predictions >= threshold).astype(int)
        
        return final_predictions
    
    def save_models_enhanced(self, filepath_prefix="models/enhanced_anomaly_detection"):
        """บันทึกโมเดลขั้นสูง - รวม Feature Info"""
        logger.info("บันทึกโมเดลขั้นสูง v2.1 (Fixed)...")
        
        os.makedirs("models", exist_ok=True)
        
        try:
            # บันทึกโมเดล
            for model_name, model in self.models.items():
                model_path = f"{filepath_prefix}_{model_name}.pkl"
                joblib.dump(model, model_path)
                logger.info(f"บันทึก {model_name} -> {model_path}")
            
            # บันทึก scalers
            scalers_path = f"{filepath_prefix}_scalers.pkl"
            joblib.dump(self.scalers, scalers_path)
            
            # บันทึก feature info และ configuration - รวม Feature Manager Info
            feature_info = {
                'feature_columns': self.feature_columns,
                'time_features': self.time_features,
                'derived_features': self.derived_features,
                'feature_importances': self.feature_importances,
                'model_config': self.model_config,
                'ensemble_weights': self.ensemble_weights,
                'model_performance': self.model_performance,
                'version': '2.1',
                'expected_features': 49,  # Fixed target
                'feature_manager_info': self.feature_manager.feature_info
            }
            
            feature_info_path = f"{filepath_prefix}_feature_info.pkl"
            joblib.dump(feature_info, feature_info_path)
            
            logger.info(f"บันทึก scalers -> {scalers_path}")
            logger.info(f"บันทึก feature info -> {feature_info_path}")
            logger.info("บันทึกโมเดลขั้นสูงเสร็จสิ้น")
            
        except Exception as e:
            logger.error(f"Error saving models: {e}")
            raise
    
    def load_models(self, filepath_prefix="models/anomaly_detection"):
        """โหลดโมเดลขั้นสูง - รวม Feature Alignment Setup"""
        logger.info("โหลดโมเดลขั้นสูง v2.1 (Fixed)...")
        
        try:
            # โหลด scalers
            scalers_path = f"{filepath_prefix}_scalers.pkl"
            if os.path.exists(scalers_path):
                self.scalers = joblib.load(scalers_path)
                logger.info("โหลด scalers สำเร็จ")
            
            # โหลด feature info
            feature_info_path = f"{filepath_prefix}_feature_info.pkl"
            if os.path.exists(feature_info_path):
                feature_info = joblib.load(feature_info_path)
                self.feature_columns = feature_info.get('feature_columns', self.feature_columns)
                self.time_features = feature_info.get('time_features', self.time_features)
                self.derived_features = feature_info.get('derived_features', [])
                self.feature_importances = feature_info.get('feature_importances', {})
                self.model_config = feature_info.get('model_config', self.model_config)
                self.ensemble_weights = feature_info.get('ensemble_weights', self.ensemble_weights)
                self.model_performance = feature_info.get('model_performance', {})
                
                # Setup Feature Manager with saved info
                expected_features = feature_info.get('expected_features', 49)
                self.feature_manager = FeatureManager(target_features=expected_features)
                self.feature_manager.feature_info = feature_info.get('feature_manager_info')
                
                version = feature_info.get('version', '1.0')
                logger.info(f"โหลด feature info สำเร็จ (version {version})")
            
            # โหลดโมเดล
            model_names = ['isolation_forest', 'one_class_svm', 'local_outlier_factor', 
                          'elliptic_envelope', 'ensemble']
            loaded_models = 0
            
            for model_name in model_names:
                model_path = f"{filepath_prefix}_{model_name}.pkl"
                if os.path.exists(model_path):
                    try:
                        self.models[model_name] = joblib.load(model_path)
                        loaded_models += 1
                        logger.info(f"โหลด {model_name} สำเร็จ")
                    except Exception as e:
                        logger.warning(f"ไม่สามารถโหลด {model_name}: {e}")
            
            if loaded_models == 0:
                raise FileNotFoundError("ไม่พบไฟล์โมเดลใดๆ")
            
            logger.info(f"โหลดโมเดลขั้นสูงเสร็จสิ้น ({loaded_models} โมเดล)")
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            logger.error(f"ไม่สามารถโหลดโมเดลได้: {e}")
            raise
    
    # Training methods with feature alignment
    def train_isolation_forest_enhanced(self, X_train, y_train):
        """เทรน Enhanced Isolation Forest - รวม Feature Alignment"""
        logger.info("เทรน Enhanced Isolation Forest v2.1 (Fixed)...")
        
        # ทำความสะอาดและ align features
        X_train_clean = self.clean_data_for_training(X_train)
        X_normal = X_train_clean[y_train == 0]
        
        # ใช้ PowerTransformer เพื่อทำให้ข้อมูลเป็น Gaussian
        scaler = PowerTransformer(method='yeo-johnson', standardize=True)
        
        try:
            X_normal_scaled = scaler.fit_transform(X_normal)
        except Exception as e:
            logger.warning(f"PowerTransformer failed, using StandardScaler: {e}")
            scaler = StandardScaler()
            X_normal_scaled = scaler.fit_transform(X_normal)
        
        # ปรับ hyperparameters ตาม contamination rate
        contamination_rate = len(y_train[y_train == 1]) / len(y_train)
        
        model_params = self.model_config['isolation_forest'].copy()
        model_params['contamination'] = min(0.2, max(0.05, contamination_rate * 0.9))
        
        model = IsolationForest(
            contamination=model_params['contamination'],
            random_state=model_params['random_state'],
            n_estimators=model_params['n_estimators'],
            max_samples=model_params['max_samples'],
            max_features=model_params['max_features'],
            bootstrap=True,
            n_jobs=-1,
            warm_start=False
        )
        
        model.fit(X_normal_scaled)
        
        self.models['isolation_forest'] = model
        self.scalers['isolation_forest'] = scaler
        
        # บันทึก performance
        self.model_performance['isolation_forest'] = {
            'contamination': model_params['contamination'],
            'n_estimators': model_params['n_estimators'],
            'training_samples': len(X_normal_scaled),
            'feature_count': X_normal_scaled.shape[1]
        }
        
        logger.info(f"Enhanced Isolation Forest เทรนเสร็จสิ้น (contamination: {model_params['contamination']:.3f})")
        return model, scaler
    
    def train_one_class_svm_enhanced(self, X_train, y_train):
        """เทรน Enhanced One-Class SVM - รวม Feature Alignment"""
        logger.info("เทรน Enhanced One-Class SVM v2.1 (Fixed)...")
        
        # ทำความสะอาดและ align features
        X_train_clean = self.clean_data_for_training(X_train)
        X_normal = X_train_clean[y_train == 0]
        
        # ใช้ RobustScaler เพื่อจัดการ outliers
        scaler = RobustScaler(quantile_range=(10, 90))
        X_normal_scaled = scaler.fit_transform(X_normal)
        
        # ปรับ hyperparameters
        contamination_rate = len(y_train[y_train == 1]) / len(y_train)
        
        model_params = self.model_config['one_class_svm'].copy()
        model_params['nu'] = min(0.2, max(0.05, contamination_rate * 0.8))
        
        # ปรับ gamma ตามขนาดข้อมูล
        if len(X_normal) > 5000:
            model_params['gamma'] = 'scale'
        else:
            model_params['gamma'] = 0.1
        
        model = OneClassSVM(
            kernel=model_params['kernel'],
            gamma=model_params['gamma'],
            nu=model_params['nu'],
            shrinking=model_params['shrinking'],
            tol=1e-4,
            cache_size=1000
        )
        
        model.fit(X_normal_scaled)
        
        self.models['one_class_svm'] = model
        self.scalers['one_class_svm'] = scaler
        
        # บันทึก performance
        self.model_performance['one_class_svm'] = {
            'nu': model_params['nu'],
            'gamma': model_params['gamma'],
            'training_samples': len(X_normal_scaled),
            'feature_count': X_normal_scaled.shape[1]
        }
        
        logger.info(f"Enhanced One-Class SVM เทรนเสร็จสิ้น (nu: {model_params['nu']:.3f})")
        return model, scaler
    
    def train_local_outlier_factor(self, X_train, y_train):
        """เทรน Local Outlier Factor - รวม Feature Alignment"""
        logger.info("เทรน Local Outlier Factor v2.1 (Fixed)...")
        
        # ทำความสะอาดและ align features
        X_train_clean = self.clean_data_for_training(X_train)
        X_normal = X_train_clean[y_train == 0]
        
        scaler = StandardScaler()
        X_normal_scaled = scaler.fit_transform(X_normal)
        
        # ปรับ n_neighbors ตามขนาดข้อมูล
        n_samples = len(X_normal)
        if n_samples < 100:
            n_neighbors = min(20, max(5, n_samples // 5))
        else:
            n_neighbors = min(50, max(20, int(np.sqrt(n_samples))))
        
        contamination_rate = len(y_train[y_train == 1]) / len(y_train)
        
        model = LocalOutlierFactor(
            n_neighbors=n_neighbors,
            contamination=min(0.2, max(0.05, contamination_rate)),
            novelty=True,
            algorithm='auto',
            leaf_size=30,
            metric='minkowski',
            p=2,
            n_jobs=-1
        )
        
        model.fit(X_normal_scaled)
        
        self.models['local_outlier_factor'] = model
        self.scalers['local_outlier_factor'] = scaler
        
        # บันทึก performance
        self.model_performance['local_outlier_factor'] = {
            'n_neighbors': n_neighbors,
            'contamination': contamination_rate,
            'training_samples': len(X_normal_scaled),
            'feature_count': X_normal_scaled.shape[1]
        }
        
        logger.info(f"Local Outlier Factor เทรนเสร็จสิ้น (n_neighbors: {n_neighbors})")
        return model, scaler
    
    def train_elliptic_envelope(self, X_train, y_train):
        """เทรน Elliptic Envelope - รวม Feature Alignment"""
        logger.info("เทรน Elliptic Envelope v2.1 (Fixed)...")
        
        # ทำความสะอาดและ align features
        X_train_clean = self.clean_data_for_training(X_train)
        X_normal = X_train_clean[y_train == 0]
        
        scaler = StandardScaler()
        X_normal_scaled = scaler.fit_transform(X_normal)
        
        contamination_rate = len(y_train[y_train == 1]) / len(y_train)
        
        # ปรับ support_fraction ตามขนาดข้อมูล
        support_fraction = None
        if len(X_normal) < 1000:
            support_fraction = 0.8
        
        model = EllipticEnvelope(
            contamination=min(0.2, max(0.05, contamination_rate)),
            random_state=42,
            support_fraction=support_fraction,
            store_precision=True
        )
        
        model.fit(X_normal_scaled)
        
        self.models['elliptic_envelope'] = model
        self.scalers['elliptic_envelope'] = scaler
        
        # บันทึก performance
        self.model_performance['elliptic_envelope'] = {
            'contamination': contamination_rate,
            'support_fraction': support_fraction,
            'training_samples': len(X_normal_scaled),
            'feature_count': X_normal_scaled.shape[1]
        }
        
        logger.info("Elliptic Envelope เทรนเสร็จสิ้น")
        return model, scaler
    
    def train_ensemble_model(self, X_train, y_train):
        """เทรน Advanced Ensemble Model - รวม Feature Alignment"""
        logger.info("เทรน Advanced Ensemble Model v2.1 (Fixed)...")
        
        # เทรนโมเดลทั้งหมด
        models_dict = {}
        scalers_dict = {}
        
        try:
            if_model, if_scaler = self.train_isolation_forest_enhanced(X_train, y_train)
            models_dict['isolation_forest'] = if_model
            scalers_dict['isolation_forest'] = if_scaler
        except Exception as e:
            logger.error(f"Failed to train Isolation Forest: {e}")
        
        try:
            svm_model, svm_scaler = self.train_one_class_svm_enhanced(X_train, y_train)
            models_dict['one_class_svm'] = svm_model
            scalers_dict['one_class_svm'] = svm_scaler
        except Exception as e:
            logger.error(f"Failed to train One-Class SVM: {e}")
        
        try:
            lof_model, lof_scaler = self.train_local_outlier_factor(X_train, y_train)
            models_dict['local_outlier_factor'] = lof_model
            scalers_dict['local_outlier_factor'] = lof_scaler
        except Exception as e:
            logger.error(f"Failed to train LOF: {e}")
        
        try:
            ee_model, ee_scaler = self.train_elliptic_envelope(X_train, y_train)
            models_dict['elliptic_envelope'] = ee_model
            scalers_dict['elliptic_envelope'] = ee_scaler
        except Exception as e:
            logger.error(f"Failed to train Elliptic Envelope: {e}")
        
        if not models_dict:
            raise ValueError("ไม่สามารถเทรนโมเดลใดๆ ได้")
        
        # ปรับ weights ตามจำนวนโมเดลที่เทรนได้
        available_models = list(models_dict.keys())
        adjusted_weights = {}
        total_weight = sum(self.ensemble_weights[model] for model in available_models)
        
        for model in available_models:
            adjusted_weights[model] = self.ensemble_weights[model] / total_weight
        
        self.models['ensemble'] = models_dict
        self.scalers['ensemble'] = scalers_dict
        self.ensemble_weights = adjusted_weights
        
        logger.info(f"Advanced Ensemble Model เทรนเสร็จสิ้น ({len(models_dict)} โมเดล)")
        logger.info(f"Adjusted weights: {adjusted_weights}")
        return models_dict, scalers_dict
    
    # Backward compatibility methods
    def prepare_data(self, df):
        """เตรียมข้อมูล (backward compatibility)"""
        return self.prepare_data_enhanced_fixed(df)
    
    def create_advanced_features(self, df):
        """สร้าง advanced features (backward compatibility)"""
        return self.create_advanced_features_fixed(df)
    
    def train_isolation_forest(self, X_train, y_train):
        return self.train_isolation_forest_enhanced(X_train, y_train)
    
    def train_one_class_svm(self, X_train, y_train):
        return self.train_one_class_svm_enhanced(X_train, y_train)
    
    def save_models(self, filepath_prefix="models/anomaly_detection"):
        """บันทึกโมเดล (backward compatibility)"""
        return self.save_models_enhanced(filepath_prefix)
    
    def evaluate_model_enhanced(self, X_test, y_test, model_name='ensemble'):
        """ประเมินประสิทธิภาพโมเดลแบบขั้นสูง v2.1 - Support Supervised Models"""
        logger.info(f"ประเมิน model {model_name} v2.1 (Fixed)...")
        
        try:
            # ✅ FIX: Handle supervised models separately
            if model_name in ['random_forest', 'gradient_boosting']:
                # Supervised models prediction
                if model_name not in self.models:
                    logger.error(f"Model {model_name} not found")
                    return {
                        'error': f'Model {model_name} not found',
                        'f1_score': 0,
                        'precision': 0,
                        'recall': 0
                    }
                
                model = self.models[model_name]
                
                # Clean and align features
                X_test_clean = self.clean_data_for_training(X_test)
                
                # Predict directly (supervised models already return 0/1)
                y_pred = model.predict(X_test_clean)
                
            else:
                # Unsupervised models prediction (original code)
                y_pred = self.predict_anomalies(X_test, model_name)
            
            # Calculate metrics (same for both types)
            report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            logger.info(f"\nClassification Report for {model_name}:")
            print(classification_report(y_test, y_pred, zero_division=0))
            
            # Confusion Matrix
            cm = confusion_matrix(y_test, y_pred)
            logger.info(f"\nConfusion Matrix:")
            print(cm)
            
            # Calculate additional metrics
            tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
            
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            
            # Calculate F1-score manually
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            
            logger.info(f"Specificity (True Negative Rate): {specificity:.4f}")
            logger.info(f"Sensitivity (True Positive Rate): {sensitivity:.4f}")
            logger.info(f"Precision: {precision:.4f}")
            logger.info(f"Recall: {recall:.4f}")
            logger.info(f"F1-Score: {f1_score:.4f}")
            
            # ROC AUC Score
            auc_score = None
            try:
                if len(np.unique(y_test)) > 1 and len(np.unique(y_pred)) > 1:
                    # Try to get probability scores if available
                    if model_name in ['random_forest', 'gradient_boosting']:
                        if hasattr(self.models[model_name], 'predict_proba'):
                            X_test_clean = self.clean_data_for_training(X_test)
                            y_proba = self.models[model_name].predict_proba(X_test_clean)[:, 1]
                            auc_score = roc_auc_score(y_test, y_proba)
                        else:
                            auc_score = roc_auc_score(y_test, y_pred)
                    else:
                        auc_score = roc_auc_score(y_test, y_pred)
                    
                    logger.info(f"ROC AUC Score: {auc_score:.4f}")
            except Exception as e:
                logger.warning(f"Cannot calculate AUC score: {e}")
            
            return {
                'predictions': y_pred,
                'true_labels': y_test,
                'confusion_matrix': cm,
                'classification_report': report,
                'specificity': specificity,
                'sensitivity': sensitivity,
                'precision': precision,
                'recall': recall,
                'f1_score': f1_score,
                'auc_score': auc_score,
                'model_performance': self.model_performance.get(model_name, {}),
                'feature_count': X_test.shape[1] if hasattr(X_test, 'shape') else 0,
                'model_type': 'supervised' if model_name in ['random_forest', 'gradient_boosting'] else 'unsupervised'
            }
        
        except Exception as e:
            logger.error(f"Error in evaluate_model_enhanced: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Return minimal result
            dummy_pred = np.zeros(len(y_test))
            return {
                'predictions': dummy_pred,
                'true_labels': y_test,
                'confusion_matrix': confusion_matrix(y_test, dummy_pred),
                'classification_report': {'accuracy': 0},
                'specificity': 0,
                'sensitivity': 0,
                'precision': 0,
                'recall': 0,
                'f1_score': 0,
                'error': str(e)
            }
    
    def evaluate_model(self, X_test, y_test, model_name='ensemble'):
        """ประเมินประสิทธิภาพโมเดล (backward compatibility)"""
        return self.evaluate_model_enhanced(X_test, y_test, model_name)

class RuleBasedAnomalyDetector:
    """Rule-based detector ที่ปรับปรุงแล้ว v2.1"""
    
    def __init__(self):
        self.rules = {
            'sudden_drop': {
                'condition': self._check_sudden_drop,
                'alert_level': 'red',
                'message': "ค่าเซนเซอร์ลดลงกะทันหัน ตรวจสอบระบบทันที",
                'priority': 3
            },
            'sudden_spike': {
                'condition': self._check_sudden_spike,
                'alert_level': 'yellow',
                'message': "ค่าเซนเซอร์พุ่งสูงผิดปกติ กรุณาตรวจสอบ",
                'priority': 2
            },
            'vpd_too_low': {
                'condition': self._check_vpd_too_low,
                'alert_level': 'red',
                'message': "VPD ต่ำเกินไป เสี่ยงโรคพืช ตรวจสอบระบบระบายอากาศ",
                'priority': 3
            },
            'low_voltage': {
                'condition': self._check_low_voltage,
                'alert_level': 'yellow',
                'message': "แรงดันไฟต่ำ ตรวจสอบระบบไฟฟ้าและแบตเตอรี่",
                'priority': 2
            },
            'dew_point_close': {
                'condition': self._check_dew_point_close,
                'alert_level': 'red',
                'message': "จุดน้ำค้างใกล้อุณหภูมิ เสี่ยงเกิดเชื้อรา",
                'priority': 3
            },
            'battery_depleted': {
                'condition': self._check_battery_depleted,
                'alert_level': 'red',
                'message': "แบตเตอรี่หมด เปลี่ยนหรือชาร์จทันที",
                'priority': 3
            },
            'sensor_failure': {
                'condition': self._check_sensor_failure,
                'alert_level': 'red',
                'message': "เซนเซอร์เสีย ค่าผิดปกติหรือคงที่",
                'priority': 3
            },
            'high_fluctuation': {
                'condition': self._check_high_fluctuation,
                'alert_level': 'yellow',
                'message': "ค่าผันผวนสูงผิดปกติ ตรวจสอบระบบ",
                'priority': 2
            },
            'environmental_stress': {
                'condition': self._check_environmental_stress,
                'alert_level': 'yellow',
                'message': "สภาพแวดล้อมไม่เหมาะสม อาจส่งผลต่อพืช",
                'priority': 2
            },
            'gradual_drift': {
                'condition': self._check_gradual_drift,
                'alert_level': 'yellow',
                'message': "เซนเซอร์เริ่มเสื่อมสภาพ ควรปรับ calibration",
                'priority': 1
            }
        }
        
        # เพิ่ม thresholds ที่ปรับปรุงแล้ว
        self.thresholds = {
            'vpd_critical': 0.3,
            'vpd_warning': 0.5,
            'dew_point_critical': 1.2,
            'voltage_critical': 2.7,
            'voltage_warning': 2.9,
            'battery_critical': 12,
            'battery_warning': 20,
            'temp_change_critical': 10,
            'temp_change_warning': 6,
            'humidity_extreme_high': 96,
            'humidity_extreme_low': 20,
            'co2_critical_high': 2000,
            'co2_warning_high': 1600
        }
    
    def detect_anomalies(self, sensor_data, data_history=None):
        """ตรวจจับความผิดปกติแบบขั้นสูง v2.1"""
        try:
            anomalies = []
            
            if isinstance(sensor_data, dict):
                current_data = sensor_data
                data_stream = [sensor_data]
            elif isinstance(sensor_data, list):
                if len(sensor_data) == 0:
                    return []
                current_data = sensor_data[-1]
                data_stream = sensor_data
            else:
                return []
            
            if not isinstance(current_data, dict):
                return []
            
            # ใช้ data_history หรือ data_stream
            if data_history and len(data_history) > 0:
                previous_data = data_history[-2] if len(data_history) > 1 else None
                full_data_stream = data_history
            else:
                previous_data = data_stream[-2] if len(data_stream) > 1 else None
                full_data_stream = data_stream
            
            # ตรวจสอบตามกฎทั้งหมด
            for rule_name, rule_config in self.rules.items():
                try:
                    is_anomaly = rule_config['condition'](current_data, previous_data, full_data_stream)
                    
                    if is_anomaly:
                        anomaly_info = {
                            'type': rule_name,
                            'alert_level': rule_config['alert_level'],
                            'message': rule_config['message'],
                            'priority': rule_config['priority'],
                            'timestamp': current_data.get('timestamp', datetime.now().isoformat()),
                            'confidence': 0.95,
                            'data': current_data.copy()
                        }
                        
                        if previous_data:
                            anomaly_info['previous_data'] = previous_data.copy()
                        
                        anomalies.append(anomaly_info)
                        
                except Exception as rule_error:
                    logger.error(f"ข้อผิดพลาดใน rule {rule_name}: {rule_error}")
                    continue
            
            # เรียงตาม priority
            anomalies.sort(key=lambda x: x['priority'], reverse=True)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"ข้อผิดพลาดใน detect_anomalies: {e}")
            return []
    
    def _safe_get_numeric_value(self, data, key, default=0):
        """ดึงค่าตัวเลขอย่างปลอดภัย"""
        try:
            value = data.get(key)
            if value is None:
                return default
            
            if isinstance(value, (int, float)):
                if not np.isfinite(value):
                    return default
                return float(value)
            elif isinstance(value, str):
                try:
                    return float(value)
                except ValueError:
                    return default
            else:
                return default
        except Exception:
            return default
    
    # Rule checking methods - ปรับปรุงให้แม่นยำขึ้น
    def _check_sudden_drop(self, current_data, previous_data, data_history):
        try:
            if previous_data is None:
                return False
            
            current_temp = self._safe_get_numeric_value(current_data, 'temperature')
            prev_temp = self._safe_get_numeric_value(previous_data, 'temperature')
            current_voltage = self._safe_get_numeric_value(current_data, 'voltage')
            prev_voltage = self._safe_get_numeric_value(previous_data, 'voltage')
            
            # ตรวจสอบการลดลงของอุณหภูมิ
            if current_temp > 0 and prev_temp > 0:
                temp_drop = prev_temp - current_temp
                temp_drop_percent = temp_drop / prev_temp if prev_temp > 0 else 0
                
                if temp_drop > self.thresholds['temp_change_critical'] or temp_drop_percent > 0.25:
                    return True
            
            # ตรวจสอบการลดลงของแรงดัน
            if current_voltage > 0 and prev_voltage > 0:
                voltage_drop = prev_voltage - current_voltage
                voltage_drop_percent = voltage_drop / prev_voltage if prev_voltage > 0 else 0
                
                if voltage_drop > 0.5 or voltage_drop_percent > 0.2:
                    return True
            
            # ตรวจสอบแรงดันต่ำมาก
            if 0 < current_voltage < self.thresholds['voltage_critical']:
                return True
            
            return False
        except Exception:
            return False
    
    def _check_sudden_spike(self, current_data, previous_data, data_history):
        try:
            if previous_data is None:
                return False
            
            current_temp = self._safe_get_numeric_value(current_data, 'temperature')
            prev_temp = self._safe_get_numeric_value(previous_data, 'temperature')
            current_voltage = self._safe_get_numeric_value(current_data, 'voltage')
            current_co2 = self._safe_get_numeric_value(current_data, 'co2')
            
            # ตรวจสอบการพุ่งสูงของอุณหภูมิ
            if current_temp > 0 and prev_temp > 0:
                temp_spike = current_temp - prev_temp
                if temp_spike > self.thresholds['temp_change_critical']:
                    return True
            
            # ตรวจสอบอุณหภูมิสูงเกินไป
            if current_temp > 45:
                return True
            
            # ตรวจสอบแรงดันสูงเกินไป
            if current_voltage > 4.0:
                return True
            
            # ตรวจสอบ CO2 สูงเกินไป
            if current_co2 > self.thresholds['co2_critical_high']:
                return True
            
            return False
        except Exception:
            return False
    
    def _check_vpd_too_low(self, current_data, previous_data, data_history):
        try:
            current_vpd = self._safe_get_numeric_value(current_data, 'vpd')
            
            # ตรวจสอบ VPD จากข้อมูลโดยตรง
            if current_vpd > 0 and current_vpd < self.thresholds['vpd_critical']:
                return True
            
            # คำนวณ VPD จากอุณหภูมิและความชื้น
            temp = self._safe_get_numeric_value(current_data, 'temperature')
            humidity = self._safe_get_numeric_value(current_data, 'humidity')
            
            if temp > 0 and 0 < humidity <= 100:
                try:
                    # คำนวณ VPD
                    saturation_vapor_pressure = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
                    actual_vapor_pressure = saturation_vapor_pressure * (humidity / 100)
                    calculated_vpd = saturation_vapor_pressure - actual_vapor_pressure
                    
                    if 0 < calculated_vpd < self.thresholds['vpd_critical']:
                        return True
                except Exception:
                    return False
            
            return False
        except Exception:
            return False
    
    def _check_low_voltage(self, current_data, previous_data, data_history):
        try:
            current_voltage = self._safe_get_numeric_value(current_data, 'voltage')
            battery_level = self._safe_get_numeric_value(current_data, 'battery_level')
            
            # ตรวจสอบแรงดันต่ำ
            if 0 < current_voltage < self.thresholds['voltage_warning']:
                return True
            
            # ตรวจสอบความสัมพันธ์ระหว่างแรงดันและแบตเตอรี่
            if (0 < current_voltage < 3.0 and 0 < battery_level < 30):
                return True
            
            return False
        except Exception:
            return False
    
    def _check_dew_point_close(self, current_data, previous_data, data_history):
        try:
            temp = self._safe_get_numeric_value(current_data, 'temperature')
            dew_point = self._safe_get_numeric_value(current_data, 'dew_point')
            humidity = self._safe_get_numeric_value(current_data, 'humidity')
            
            # ตรวจสอบจากข้อมูล dew point โดยตรง
            if temp > 0 and dew_point > 0:
                temp_diff = temp - dew_point
                if temp_diff < self.thresholds['dew_point_critical']:
                    return True
            
            # คำนวณ dew point จากอุณหภูมิและความชื้น
            if temp > 0 and 0 < humidity <= 100:
                try:
                    a, b = 17.27, 237.7
                    alpha = ((a * temp) / (b + temp)) + np.log(humidity / 100)
                    calculated_dew_point = (b * alpha) / (a - alpha)
                    
                    temp_diff = temp - calculated_dew_point
                    if temp_diff < self.thresholds['dew_point_critical']:
                        return True
                except Exception:
                    return False
            
            # ตรวจสอบความชื้นสูงมาก + อุณหภูมิต่ำ (เสี่ยงเกิดน้ำค้าง)
            if humidity > 95 and temp < 25:
                return True
            
            return False
        except Exception:
            return False
    
    def _check_battery_depleted(self, current_data, previous_data, data_history):
        try:
            battery_level = self._safe_get_numeric_value(current_data, 'battery_level')
            voltage = self._safe_get_numeric_value(current_data, 'voltage')
            
            # ตรวจสอบแบตเตอรี่หมด
            if battery_level > 0 and battery_level < self.thresholds['battery_critical']:
                return True
            
            # ตรวจสอบแรงดันต่ำมาก (บ่งชี้แบตเตอรี่หมด)
            if 0 < voltage < 2.3:
                return True
            
            # ตรวจสอบการลดลงของแบตเตอรี่อย่างรวดเร็ว
            if previous_data:
                prev_battery = self._safe_get_numeric_value(previous_data, 'battery_level')
                if prev_battery > 0 and battery_level > 0:
                    battery_drop = prev_battery - battery_level
                    if battery_drop > 20:  # ลดลงมากกว่า 20% ในครั้งเดียว
                        return True
            
            return False
        except Exception:
            return False
    
    def _check_sensor_failure(self, current_data, previous_data, data_history):
        try:
            failure_values = [0, -999, 999, -1, 9999, None]
            
            # ตรวจสอบค่า error codes
            critical_sensors = ['temperature', 'humidity', 'voltage']
            failed_sensors = 0
            
            for sensor in critical_sensors:
                value = current_data.get(sensor)
                if value in failure_values:
                    failed_sensors += 1
                elif isinstance(value, (int, float)):
                    # ตรวจสอบค่าที่ผิดปกติ
                    if sensor == 'temperature' and (value < -50 or value > 80):
                        failed_sensors += 1
                    elif sensor == 'humidity' and (value < 0 or value > 100):
                        failed_sensors += 1
                    elif sensor == 'voltage' and (value <= 0 or value > 5.5):
                        failed_sensors += 1
            
            # ถ้าเซนเซอร์สำคัญเสียมากกว่า 1 ตัว
            if failed_sensors >= 2:
                return True
            
            # ตรวจสอบค่าที่ไม่เปลี่ยนแปลง (stuck values)
            if len(data_history) >= 5:
                recent_data = data_history[-5:]
                for sensor in critical_sensors:
                    values = [self._safe_get_numeric_value(d, sensor) for d in recent_data]
                    unique_values = len(set(values))
                    if unique_values == 1 and values[0] not in [0, None]:
                        # ค่าเดิมๆ 5 ครั้งติดต่อกัน (ไม่รวม 0 หรือ None)
                        return True
            
            return False
        except Exception:
            return False
    
    def _check_high_fluctuation(self, current_data, previous_data, data_history):
        try:
            if previous_data is None:
                return False
            
            fluctuation_sensors = ['temperature', 'humidity', 'voltage', 'co2']
            high_fluctuation_count = 0
            
            for sensor in fluctuation_sensors:
                current_val = self._safe_get_numeric_value(current_data, sensor)
                prev_val = self._safe_get_numeric_value(previous_data, sensor)
                
                if current_val > 0 and prev_val > 0:
                    change_percent = abs(current_val - prev_val) / prev_val if prev_val > 0 else 0
                    
                    # กำหนดเกณฑ์การเปลี่ยนแปลงตามประเภทเซนเซอร์
                    if sensor == 'temperature' and change_percent > 0.15:  # 15%
                        high_fluctuation_count += 1
                    elif sensor == 'humidity' and change_percent > 0.20:  # 20%
                        high_fluctuation_count += 1
                    elif sensor == 'voltage' and change_percent > 0.25:  # 25%
                        high_fluctuation_count += 1
                    elif sensor == 'co2' and change_percent > 0.30:  # 30%
                        high_fluctuation_count += 1
            
            # ถ้ามีเซนเซอร์ที่ผันผวนสูงมากกว่า 2 ตัว
            return high_fluctuation_count >= 2
            
        except Exception:
            return False
    
    def _check_environmental_stress(self, current_data, previous_data, data_history):
        try:
            temp = self._safe_get_numeric_value(current_data, 'temperature')
            humidity = self._safe_get_numeric_value(current_data, 'humidity')
            vpd = self._safe_get_numeric_value(current_data, 'vpd')
            co2 = self._safe_get_numeric_value(current_data, 'co2')
            
            stress_factors = 0
            
            # ความชื้นสูงเกินไป + อุณหภูมิต่ำ (เสี่ยงเชื้อรา)
            if humidity > self.thresholds['humidity_extreme_high'] and temp < 18:
                stress_factors += 1
            
            # ความชื้นต่ำเกินไป + อุณหภูมิสูง (ความเครียดจากแห้ง)
            if humidity < self.thresholds['humidity_extreme_low'] and temp > 38:
                stress_factors += 1
            
            # VPD ในช่วงเสี่ยง
            if 0 < vpd < self.thresholds['vpd_warning']:
                stress_factors += 1
            
            # CO2 สูงเกินไป
            if co2 > self.thresholds['co2_warning_high']:
                stress_factors += 1
            
            # สภาพอากาศรุนแรง
            if temp > 42 or temp < 8:
                stress_factors += 1
            
            # ถ้ามี stress factors มากกว่าหรือเท่ากับ 2
            return stress_factors >= 2
            
        except Exception:
            return False
    
    def _check_gradual_drift(self, current_data, previous_data, data_history):
        try:
            if len(data_history) < 8:  # ต้องมีข้อมูลอย่างน้อย 8 จุด
                return False
            
            recent_data = data_history[-8:]  # ดูข้อมูล 8 จุดล่าสุด
            sensors_to_check = ['temperature', 'ec', 'ph']
            
            for sensor in sensors_to_check:
                values = [self._safe_get_numeric_value(d, sensor) for d in recent_data]
                values = [v for v in values if v > -100]  # กรองค่า error ออก
                
                if len(values) < 5:  # ต้องมีข้อมูลที่ใช้ได้อย่างน้อย 5 จุด
                    continue
                
                try:
                    # คำนวณ trend โดยใช้ linear regression
                    x = np.arange(len(values))
                    slope = np.polyfit(x, values, 1)[0]
                    
                    # กำหนดเกณฑ์ drift ตามประเภทเซนเซอร์
                    drift_threshold = {
                        'temperature': 0.8,  # 0.8°C ต่อ reading
                        'ec': 0.15,          # 0.15 EC ต่อ reading
                        'ph': 0.2            # 0.2 pH ต่อ reading
                    }
                    
                    if abs(slope) > drift_threshold.get(sensor, 0.5):
                        return True
                        
                except Exception:
                    continue
            
            return False
            
        except Exception:
            return False


# การทดสอบ
if __name__ == "__main__":
    print("ทดสอบ Enhanced Anomaly Detection Models v2.1 (Fixed)")
    print("="*80)
    
    # ทดสอบ Rule-based Detector
    print("\nทดสอบ Enhanced Rule-based Detection v2.1...")
    rule_detector = RuleBasedAnomalyDetector()
    
    # ข้อมูลทดสอบที่หลากหลายขึ้น
    test_cases = [
        {
            'name': 'ข้อมูลปกติคุณภาพสูง',
            'data': {
                'temperature': 26.2,
                'humidity': 64.8,
                'vpd': 1.15,
                'dew_point': 18.5,
                'voltage': 3.28,
                'battery_level': 82,
                'co2': 750,
                'ec': 1.48,
                'ph': 6.52,
                'timestamp': datetime.now().isoformat()
            }
        },
        {
            'name': 'ความเครียดสิ่งแวดล้อมรุนแรง',
            'data': {
                'temperature': 44.0,
                'humidity': 18.0,
                'vpd': 4.2,
                'dew_point': 5.0,
                'voltage': 3.25,
                'battery_level': 75,
                'co2': 1850,
                'timestamp': datetime.now().isoformat()
            }
        },
        {
            'name': 'ระบบไฟฟ้าเสีย',
            'data': {
                'temperature': 25.0,
                'humidity': 65.0,
                'voltage': 2.1,
                'battery_level': 8,
                'co2': 800,
                'timestamp': datetime.now().isoformat()
            }
        },
        {
            'name': 'หลายเซนเซอร์เสียพร้อมกัน',
            'data': {
                'temperature': -999,
                'humidity': 0,
                'voltage': 0,
                'battery_level': 0,
                'co2': -999,
                'ec': -99,
                'ph': -1,
                'timestamp': datetime.now().isoformat()
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\nทดสอบ: {test_case['name']}")
        
        anomalies = rule_detector.detect_anomalies([test_case['data']])
        
        if anomalies:
            print("พบความผิดปกติ:")
            for anomaly in anomalies[:3]:  # แสดงแค่ 3 อันดับแรก
                alert_icon = "🔴" if anomaly['alert_level'] == 'red' else "⚠️"
                print(f"  {alert_icon} {anomaly['type']}: {anomaly['message']}")
                print(f"      Priority: {anomaly['priority']}, Confidence: {anomaly['confidence']:.2f}")
        else:
            print("✅ ไม่พบความผิดปกติ")
    
    print(f"\nการทดสอบ Enhanced Models v2.1 (Fixed) เสร็จสิ้น!")
    print("พร้อมสำหรับการเทรนประสิทธิภาพสูง")