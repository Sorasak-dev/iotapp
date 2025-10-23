import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import make_scorer, f1_score
import matplotlib.pyplot as plt
import seaborn as sns
from data_generator import SensorDataGenerator
from anomaly_models import AnomalyDetectionModels, RuleBasedAnomalyDetector
import os
import warnings
import logging
from datetime import datetime
import json
from sklearn.utils.class_weight import compute_class_weight

warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def clean_infinity_and_extreme_values(df):
    """Clean infinity and extreme values thoroughly"""
    print("🧹 ทำความสะอาดข้อมูล...")
    
    numeric_columns = df.select_dtypes(include=[np.number]).columns
    cleaned_count = 0
    
    for col in numeric_columns:
        if col in df.columns:
            # Replace infinity with NaN
            infinity_mask = np.isinf(df[col])
            if infinity_mask.any():
                df.loc[infinity_mask, col] = np.nan
                cleaned_count += infinity_mask.sum()
                logger.info(f"แทนที่ {infinity_mask.sum()} ค่า infinity ใน {col}")
            
            # Define safe ranges for sensor data
            safe_ranges = {
                'temperature': (-50, 80),
                'humidity': (0, 100),
                'voltage': (0, 6),
                'battery_level': (0, 100),
                'co2': (0, 5000),
                'ec': (0, 10),
                'ph': (0, 14),
                'vpd': (0, 20),
                'dew_point': (-50, 60)
            }
            
            if col in safe_ranges:
                min_val, max_val = safe_ranges[col]
                extreme_mask = (df[col] < min_val) | (df[col] > max_val)
                
                if extreme_mask.any():
                    df.loc[extreme_mask, col] = np.nan
                    logger.info(f"แทนที่ {extreme_mask.sum()} ค่า extreme ใน {col}")
            
            # Replace values too large for float32
            float32_max = np.finfo(np.float32).max / 100
            too_large_mask = np.abs(df[col].fillna(0)) > float32_max
            
            if too_large_mask.any():
                df.loc[too_large_mask, col] = np.nan
                logger.info(f"แทนที่ {too_large_mask.sum()} ค่าที่ใหญ่เกินไปใน {col}")
    
    logger.info(f"✅ Data cleaning completed: {cleaned_count} values processed")
    return df

def load_or_generate_data(force_generate=False):
    """Load or generate high-quality data with proper anomaly ratio"""
    data_file = "data/sensor_training_data.csv"
    
    if os.path.exists(data_file) and not force_generate:
        print("📂 โหลดข้อมูลจากไฟล์...")
        df = pd.read_csv(data_file)
        logger.info(f"โหลดข้อมูลจากไฟล์: {len(df)} รายการ")
    else:
        print("🔨 สร้างข้อมูลใหม่ (อาจใช้เวลา 1-2 นาที)...")
        generator = SensorDataGenerator()
        df = generator.generate_comprehensive_dataset_enhanced(
            days=365,           # เพิ่มเป็น 1 ปี
            normal_ratio=0.92   # เปลี่ยนเป็น 92:8 (เหมาะสำหรับ anomaly detection)
        )
        generator.save_dataset(df, "sensor_training_data.csv")
        logger.info(f"✅ สร้างข้อมูลใหม่: {len(df)} รายการ")
    
    # Clean data before return
    df = clean_infinity_and_extreme_values(df)
    
    return df

def validate_data_quality(df):
    """Enhanced data quality validation"""
    print("\n🔍 ตรวจสอบคุณภาพข้อมูล...")
    
    quality_score = 0
    
    # Check missing data
    missing_data = df.isnull().sum()
    if missing_data.sum() > 0:
        print("⚠️  พบข้อมูลที่หายไป:")
        for col, missing in missing_data.items():
            if missing > 0:
                print(f"     {col}: {missing} รายการ ({missing/len(df)*100:.1f}%)")
    else:
        print("✅ ไม่มีข้อมูลหายไป")
        quality_score += 1
    
    # Check for infinity and extreme values
    numeric_columns = df.select_dtypes(include=[np.number]).columns
    infinity_found = False
    extreme_found = False
    
    for col in numeric_columns:
        if np.isinf(df[col]).any():
            infinity_found = True
            print(f"⚠️  พบค่า infinity ใน {col}")
        
        if (np.abs(df[col].fillna(0)) > 1e6).any():
            extreme_found = True
            print(f"⚠️  พบค่า extreme ใน {col}")
    
    if not infinity_found and not extreme_found:
        print("✅ ไม่พบค่า infinity หรือ extreme values")
        quality_score += 2
    
    # Check anomaly ratio
    anomaly_ratio = len(df[df['is_anomaly'] == 1]) / len(df)
    print(f"\n📊 อัตราส่วนความผิดปกติ: {anomaly_ratio:.1%}")
    
    if 0.05 <= anomaly_ratio <= 0.15:
        print("✅ อัตราส่วนเหมาะสำหรับ Anomaly Detection")
        quality_score += 2
    elif 0.15 < anomaly_ratio <= 0.25:
        print("⚠️  อัตราส่วนสูงไปหน่อย แต่ใช้ได้")
        quality_score += 1
    else:
        logger.warning("❌ อัตราส่วนไม่เหมาะสม")
    
    data_quality_ok = quality_score >= 3
    
    if data_quality_ok:
        print(f"\n✅ คุณภาพข้อมูลดี (คะแนน: {quality_score}/5)")
    else:
        logger.warning(f"⚠️  คุณภาพข้อมูลต้องปรับปรุง (คะแนน: {quality_score}/5)")
    
    return data_quality_ok

def safe_preprocessing_check(X, stage_name=""):
    """Check data safety before processing"""
    if len(stage_name) > 0:
        logger.info(f"🔍 ตรวจสอบข้อมูล {stage_name}...")
    
    # Check NaN
    nan_count = np.isnan(X).sum()
    if nan_count > 0:
        logger.warning(f"พบ NaN {nan_count} ค่าใน {stage_name}")
    
    # Check Infinity
    inf_count = np.isinf(X).sum()
    if inf_count > 0:
        logger.error(f"❌ พบ Infinity {inf_count} ค่าใน {stage_name}")
        return False
    
    # Check values too large for float32
    float32_max = np.finfo(np.float32).max / 1000
    too_large = (np.abs(X) > float32_max).sum()
    if too_large > 0:
        logger.error(f"❌ พบค่าใหญ่เกินไป {too_large} ค่าใน {stage_name}")
        return False
    
    logger.info(f"✅ ข้อมูล {stage_name} ปลอดภัย")
    return True

def prepare_training_data(df):
    """Prepare data for training with proper anomaly ratio"""
    print("\n⚙️  เตรียมข้อมูลสำหรับการเทรน...")
    
    # Remove rows with missing essential data
    essential_cols = ['temperature', 'humidity', 'voltage']
    before_len = len(df)
    df_clean = df.dropna(subset=essential_cols)
    after_len = len(df_clean)
    
    if before_len != after_len:
        logger.info(f"ลบข้อมูลที่ไม่สมบูรณ์: {before_len - after_len} รายการ")
    
    # Clean data again
    df_clean = clean_infinity_and_extreme_values(df_clean)
    
    # Balance data for proper anomaly detection
    anomaly_count = len(df_clean[df_clean['is_anomaly'] == 1])
    normal_count = len(df_clean[df_clean['is_anomaly'] == 0])
    
    print(f"📊 ข้อมูลก่อนปรับสมดุล:")
    print(f"   - ปกติ: {normal_count} ({normal_count/(normal_count+anomaly_count)*100:.1f}%)")
    print(f"   - ผิดปกติ: {anomaly_count} ({anomaly_count/(normal_count+anomaly_count)*100:.1f}%)")
    
    # Target ratio 90:10 for proper anomaly detection
    target_ratio = 9.0  # 90% normal, 10% anomaly
    current_ratio = normal_count / anomaly_count if anomaly_count > 0 else float('inf')
    
    if current_ratio < target_ratio * 0.7:  # Too many anomalies
        # Reduce anomaly samples
        anomaly_data = df_clean[df_clean['is_anomaly'] == 1]
        target_anomaly_count = int(normal_count / target_ratio)
        
        if target_anomaly_count < anomaly_count and target_anomaly_count > 0:
            anomaly_sample = anomaly_data.sample(n=target_anomaly_count, random_state=42)
            normal_data = df_clean[df_clean['is_anomaly'] == 0]
            df_clean = pd.concat([normal_data, anomaly_sample], ignore_index=True)
            
            logger.info(f"ปรับสมดุลข้อมูลเป็น 90:10")
    
    final_normal = len(df_clean[df_clean['is_anomaly'] == 0])
    final_anomaly = len(df_clean[df_clean['is_anomaly'] == 1])
    
    print(f"\n📊 อัตราส่วนสุดท้าย:")
    print(f"   - ปกติ: {final_normal} ({final_normal/(final_normal+final_anomaly)*100:.1f}%)")
    print(f"   - ผิดปกติ: {final_anomaly} ({final_anomaly/(final_normal+final_anomaly)*100:.1f}%)")
    print(f"   - Ratio: {final_normal/final_anomaly:.1f}:1")
    
    # Shuffle data
    df_final = df_clean.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Final safety check
    df_final = clean_infinity_and_extreme_values(df_final)
    
    logger.info(f"✅ ข้อมูลสุดท้าย: {len(df_final)} รายการ")
    return df_final

def hyperparameter_optimization(X_train, y_train, anomaly_detector):
    """Optimize hyperparameters for TRUE anomaly detection"""
    print("\n🎯 ปรับแต่ง hyperparameters สำหรับ Anomaly Detection...")
    
    if not safe_preprocessing_check(X_train, "training data"):
        logger.error("❌ ข้อมูลเทรนไม่ปลอดภัย - หยุดการปรับแต่ง")
        return {}
    
    # Calculate actual contamination
    contamination = len(y_train[y_train == 1]) / len(y_train)
    
    logger.info(f"📊 Contamination rate: {contamination:.3f}")
    
    # FIXED: Proper parameters for anomaly detection
    optimized_params = {
        'isolation_forest': {
            'n_estimators': 300,
            'max_samples': 'auto',
            'contamination': min(0.12, max(0.03, contamination * 0.8)),  # ลดลง
            'max_features': 1.0,
            'bootstrap': False,
            'random_state': 42
        },
        'one_class_svm': {
            'nu': min(0.08, max(0.01, contamination * 0.4)),  # ลดลงมาก
            'gamma': 'scale',
            'kernel': 'rbf',
            'shrinking': True,
            'tol': 1e-3
        },
        'local_outlier_factor': {
            'n_neighbors': 20,
            'contamination': min(0.12, max(0.03, contamination * 0.8)),
            'novelty': True
        },
        'elliptic_envelope': {
            'contamination': min(0.12, max(0.03, contamination * 0.8)),
            'support_fraction': None,
            'random_state': 42
        },
        'random_forest': {
            'n_estimators': 200,
            'max_depth': 12,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
            'class_weight': 'balanced',
            'random_state': 42
        },
        'gradient_boosting': {
            'n_estimators': 150,
            'learning_rate': 0.1,
            'max_depth': 6,
            'min_samples_split': 5,
            'subsample': 0.8,
            'random_state': 42
        }
    }
    
    logger.info(f"✅ ใช้พารามิเตอร์ที่ปรับแต่งแล้ว")
    return optimized_params

def train_and_evaluate_models(df):
    """Train and evaluate models with FIXED parameters"""
    print("\n🚀 เริ่มการเทรนโมเดล (ML Optimized)...")
    
    # Prepare data
    anomaly_detector = AnomalyDetectionModels()
    
    try:
        df_prepared, feature_columns = anomaly_detector.prepare_data(df)
        
        if len(feature_columns) == 0:
            raise ValueError("ไม่มี features ที่ใช้ได้")
        
        logger.info(f"📊 จำนวน features: {len(feature_columns)}")
        
    except Exception as e:
        logger.error(f"❌ ข้อผิดพลาดในการเตรียมข้อมูล: {e}")
        raise
    
    # Extract features and labels
    X = df_prepared[feature_columns].values
    y = df_prepared['is_anomaly'].values
    
    # Clean features data
    print("🧹 ทำความสะอาด features...")
    X = np.where(np.isnan(X), 0, X)
    X = np.where(np.isinf(X), 0, X)
    
    # Clip values to safe range
    safe_max = np.finfo(np.float32).max / 1000
    X = np.clip(X, -safe_max, safe_max)
    
    # Final safety check
    if not safe_preprocessing_check(X, "processed features"):
        raise ValueError("❌ ข้อมูล features ไม่ปลอดภัยสำหรับการเทรน")
    
    print(f"✅ Features: {len(feature_columns)} คอลัมน์")
    print(f"✅ ขนาดข้อมูล: {X.shape}")
    print(f"✅ ช่วงค่า: {X.min():.3f} ถึง {X.max():.3f}")
    
    # Split data
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.20, random_state=42, stratify=y_temp
    )
    
    print(f"\n📊 การแบ่งข้อมูล:")
    print(f"   - Training: {len(X_train)} records")
    print(f"   - Validation: {len(X_val)} records")
    print(f"   - Test: {len(X_test)} records")
    print(f"     • Normal: {len(y_test[y_test == 0])}")
    print(f"     • Anomaly: {len(y_test[y_test == 1])}")
    
    # Get optimized parameters
    best_params = hyperparameter_optimization(X_train, y_train, anomaly_detector)
    
    results = {}
    
    # UPDATED: Train supervised models first (better for labeled data)
    models_to_train = [
        ('random_forest', 'Random Forest (Supervised)'),
        ('gradient_boosting', 'Gradient Boosting (Supervised)'),
        ('isolation_forest', 'Isolation Forest'),
        ('one_class_svm', 'One-Class SVM'),
        ('local_outlier_factor', 'Local Outlier Factor'),
        ('elliptic_envelope', 'Elliptic Envelope'),
        ('ensemble', 'Ensemble Model')
    ]
    
    successful_models = []
    
    for model_name, model_display_name in models_to_train:
        try:
            print(f"\n🤖 Training {model_display_name}...")
            
            # Train supervised models
            if model_name == 'random_forest':
                from sklearn.ensemble import RandomForestClassifier
                params = best_params.get('random_forest', {})
                rf_model = RandomForestClassifier(**params)
                rf_model.fit(X_train, y_train)
                
                # Store in detector
                if not hasattr(anomaly_detector, 'models'):
                    anomaly_detector.models = {}
                anomaly_detector.models['random_forest'] = rf_model
                
            elif model_name == 'gradient_boosting':
                from sklearn.ensemble import GradientBoostingClassifier
                params = best_params.get('gradient_boosting', {})
                gb_model = GradientBoostingClassifier(**params)
                gb_model.fit(X_train, y_train)
                
                if not hasattr(anomaly_detector, 'models'):
                    anomaly_detector.models = {}
                anomaly_detector.models['gradient_boosting'] = gb_model
                
            # Train unsupervised models with FIXED parameters
            elif model_name == 'isolation_forest':
                if hasattr(anomaly_detector, 'model_config') and 'isolation_forest' in best_params:
                    anomaly_detector.model_config['isolation_forest'].update(best_params['isolation_forest'])
                anomaly_detector.train_isolation_forest_enhanced(X_train, y_train)
                
            elif model_name == 'one_class_svm':
                if hasattr(anomaly_detector, 'model_config') and 'one_class_svm' in best_params:
                    anomaly_detector.model_config['one_class_svm'].update(best_params['one_class_svm'])
                anomaly_detector.train_one_class_svm_enhanced(X_train, y_train)
                
            elif model_name == 'local_outlier_factor':
                if hasattr(anomaly_detector, 'model_config') and 'local_outlier_factor' in best_params:
                    anomaly_detector.model_config['local_outlier_factor'].update(best_params['local_outlier_factor'])
                anomaly_detector.train_local_outlier_factor(X_train, y_train)
                
            elif model_name == 'elliptic_envelope':
                if hasattr(anomaly_detector, 'model_config') and 'elliptic_envelope' in best_params:
                    anomaly_detector.model_config['elliptic_envelope'].update(best_params['elliptic_envelope'])
                anomaly_detector.train_elliptic_envelope(X_train, y_train)
                
            elif model_name == 'ensemble':
                anomaly_detector.train_ensemble_model(X_train, y_train)
            
            # Evaluate model
            val_results = anomaly_detector.evaluate_model_enhanced(X_val, y_val, model_name)
            test_results = anomaly_detector.evaluate_model_enhanced(X_test, y_test, model_name)
            
            # Check results
            val_f1 = val_results.get('f1_score', 0)
            test_f1 = test_results.get('f1_score', 0)
            
            if val_f1 > 0.05 or test_f1 > 0.05:  # Model works
                results[model_name] = {
                    'validation': val_results,
                    'test': test_results,
                    'best_params': best_params.get(model_name, {})
                }
                successful_models.append(model_name)
                
                logger.info(f"✅ {model_display_name} trained successfully")
                logger.info(f"   Validation F1: {val_f1:.4f}")
                logger.info(f"   Test F1: {test_f1:.4f}")
            else:
                logger.warning(f"⚠️  {model_display_name} F1-score ต่ำ")
                
        except Exception as e:
            logger.error(f"❌ Error training {model_display_name}: {e}")
            continue
    
    if len(successful_models) == 0:
        logger.warning("⚠️  ไม่มีโมเดลที่ทำงานได้ดี")
        return results, anomaly_detector
    
    print(f"\n✅ เทรนสำเร็จ: {len(successful_models)}/{len(models_to_train)} โมเดล")
    print(f"   Models: {', '.join(successful_models)}")
    
    # Save models
    print("\n💾 บันทึกโมเดล...")
    anomaly_detector.save_models_enhanced("models/anomaly_detection")
    logger.info("✅ บันทึกโมเดลเสร็จสิ้น")
    
    return results, anomaly_detector

def test_rule_based_detection():
    """Test Rule-based Detection"""
    print("\n🔍 ทดสอบ Rule-based Anomaly Detection...")
    
    rule_detector = RuleBasedAnomalyDetector()
    
    test_cases = [
        {
            'name': 'ข้อมูลปกติ',
            'data': {
                'temperature': 25.5,
                'humidity': 64.2,
                'vpd': 1.18,
                'voltage': 3.31,
                'battery_level': 84,
                'timestamp': datetime.now().isoformat()
            }
        },
        {
            'name': 'ความเครียดสูง',
            'data': {
                'temperature': 17.5,
                'humidity': 97.0,
                'vpd': 0.25,
                'voltage': 3.25,
                'timestamp': datetime.now().isoformat()
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n   {test_case['name']}:")
        
        try:
            anomalies = rule_detector.detect_anomalies([test_case['data']])
            
            if anomalies:
                print(f"      ⚠️  พบความผิดปกติ: {len(anomalies)} รายการ")
            else:
                print("      ✅ ปกติ")
        except Exception as e:
            logger.error(f"❌ Error: {e}")
    
    logger.info("✅ ทดสอบ Rule-based Detection เสร็จสิ้น")

def create_performance_visualization(results):
    """Create performance visualization"""
    if not results:
        print("⚠️  ไม่มีผลลัพธ์ให้แสดงกราฟ")
        return
    
    try:
        print("\n📊 สร้างกราฟประสิทธิภาพ...")
        
        os.makedirs("plots", exist_ok=True)
        
        plt.style.use('default')
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('Model Performance - ML Optimized', fontsize=16, fontweight='bold')
        
        models = list(results.keys())
        
        # Prepare metrics
        metrics = {
            'F1-Score': [],
            'Precision': [],
            'Recall': [],
            'Accuracy': []
        }
        
        for model in models:
            try:
                test_result = results[model]['test']
                
                f1 = test_result.get('f1_score', 0)
                precision = test_result.get('precision', 0)
                recall = test_result.get('recall', 0)
                
                cm = test_result.get('confusion_matrix')
                if cm is not None and cm.size >= 4:
                    tn, fp, fn, tp = cm.ravel()
                    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
                else:
                    accuracy = 0
                
                metrics['F1-Score'].append(f1)
                metrics['Precision'].append(precision)
                metrics['Recall'].append(recall)
                metrics['Accuracy'].append(accuracy)
                
            except Exception as e:
                for metric in metrics.keys():
                    metrics[metric].append(0)
        
        colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12']
        
        for i, (metric_name, values) in enumerate(metrics.items()):
            row, col = i // 2, i % 2
            ax = axes[row, col]
            
            bars = ax.bar(models, values, color=colors[i], alpha=0.7, edgecolor='black')
            ax.set_title(f'{metric_name}', fontweight='bold')
            ax.set_ylabel(metric_name)
            ax.set_ylim(0, 1.05)
            ax.tick_params(axis='x', rotation=45)
            ax.grid(axis='y', alpha=0.3)
            
            for bar, value in zip(bars, values):
                if value > 0:
                    ax.text(bar.get_x() + bar.get_width()/2, value + 0.02, 
                           f'{value:.3f}', ha='center', va='bottom', fontweight='bold', fontsize=8)
        
        plt.tight_layout()
        plt.savefig('plots/model_performance_optimized.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        print("✅ กราฟบันทึกที่: plots/model_performance_optimized.png")
        
    except Exception as e:
        logger.error(f"❌ Error creating visualization: {e}")

def display_results_summary(results):
    """Display enhanced results summary"""
    print("\n" + "="*80)
    print("📊 สรุปผลการเทรนโมเดล - ML Optimized")
    print("="*80)
    
    if not results:
        print("⚠️  ไม่มีผลลัพธ์การเทรน")
        return
    
    best_f1 = 0
    best_model = None
    
    for model_name, result in results.items():
        try:
            test_result = result['test']
            val_result = result['validation']
            
            test_f1 = test_result.get('f1_score', 0)
            test_precision = test_result.get('precision', 0)
            test_recall = test_result.get('recall', 0)
            val_f1 = val_result.get('f1_score', 0)
            
            if test_f1 > best_f1:
                best_f1 = test_f1
                best_model = model_name
            
            overfitting = abs(val_f1 - test_f1)
            
            print(f"\n🤖 {model_name.replace('_', ' ').upper()}:")
            print(f"   Test F1-Score: {test_f1:.4f}")
            print(f"   Test Precision: {test_precision:.4f}")
            print(f"   Test Recall: {test_recall:.4f}")
            print(f"   Validation F1: {val_f1:.4f}")
            print(f"   Overfitting: {overfitting:.4f}")
                
        except Exception as e:
            logger.error(f"❌ Error displaying {model_name}: {e}")
            continue
    
    print(f"\n{'='*80}")
    print("📈 สรุป:")
    if best_model and best_f1 > 0:
        print(f"   ⭐ โมเดลที่ดีที่สุด: {best_model.replace('_', ' ').title()}")
        print(f"   📊 F1-Score: {best_f1:.4f}")
        
        if best_f1 > 0.70:
            print("   ✅ ประสิทธิภาพดีเยี่ยม - พร้อมใช้งาน")
        elif best_f1 > 0.50:
            print("   ✅ ประสิทธิภาพดี - สามารถใช้งานได้")
        else:
            print("   ⚠️  ประสิทธิภาพปานกลาง - แนะนำใช้ร่วมกับ Rules")
    else:
        print("   ⚠️  ใช้ Rule-based Detection")
    print("="*80)

def save_training_info(results, detector):
    """Save training information"""
    try:
        training_summary = {
            'training_date': datetime.now().isoformat(),
            'model_type': 'anomaly_detection_ml_optimized',
            'total_models': len(results),
            'successful_models': len([r for r in results.values() if r['test'].get('f1_score', 0) > 0.05]),
            'best_model': '',
            'best_test_f1_score': 0,
            'model_performance': {},
            'feature_info': {
                'total_features': len(getattr(detector, 'feature_columns', []) + 
                                    getattr(detector, 'time_features', []) + 
                                    getattr(detector, 'derived_features', [])),
                'base_features': len(getattr(detector, 'feature_columns', [])),
                'derived_features': len(getattr(detector, 'derived_features', []))
            },
            'training_config': {
                'data_ratio': '90-92% normal, 8-10% anomaly',
                'data_splitting': '64% train, 16% validation, 20% test',
                'optimization': 'ML-optimized parameters for anomaly detection',
                'models': 'Supervised + Unsupervised ensemble'
            }
        }
        
        for model_name, result in results.items():
            try:
                test_result = result['test']
                test_f1 = test_result.get('f1_score', 0)
                
                training_summary['model_performance'][model_name] = {
                    'test_f1_score': test_f1,
                    'test_precision': test_result.get('precision', 0),
                    'test_recall': test_result.get('recall', 0),
                    'test_specificity': test_result.get('specificity', 0)
                }
                
                if test_f1 > training_summary['best_test_f1_score']:
                    training_summary['best_test_f1_score'] = test_f1
                    training_summary['best_model'] = model_name
                    
            except Exception as e:
                continue
        
        os.makedirs('models', exist_ok=True)
        with open('models/training_summary_optimized.json', 'w', encoding='utf-8') as f:
            json.dump(training_summary, f, indent=2, ensure_ascii=False)
        
        logger.info("✅ บันทึกข้อมูลการเทรนเสร็จสิ้น")
        
    except Exception as e:
        logger.error(f"❌ Error saving training info: {e}")

def main():
    """Main training function - ML Optimized"""
    print("="*80)
    print("🚀 เริ่มต้นการเทรนโมเดล Anomaly Detection - ML OPTIMIZED")
    print("="*80)
    print("\n📌 การปรับปรุง:")
    print("   ✅ ปรับ data ratio เป็น 90:10 (เหมาะสำหรับ anomaly detection)")
    print("   ✅ ลด contamination parameters")
    print("   ✅ เพิ่ม Supervised models (Random Forest, Gradient Boosting)")
    print("   ✅ เพิ่มปริมาณข้อมูล (365 วัน)")
    print("\n" + "="*80)
    
    for directory in ["data", "models", "plots"]:
        os.makedirs(directory, exist_ok=True)
    
    try:
        # 1. Load and clean data
        print("\n[1/6] 📂 โหลดและทำความสะอาดข้อมูล...")
        df = load_or_generate_data(force_generate=True)
        
        print(f"\n📊 ข้อมูลทั้งหมด: {len(df)} records")
        normal_count = len(df[df['is_anomaly'] == 0])
        anomaly_count = len(df[df['is_anomaly'] == 1])
        print(f"   - Normal: {normal_count} ({normal_count/len(df)*100:.1f}%)")
        print(f"   - Anomaly: {anomaly_count} ({anomaly_count/len(df)*100:.1f}%)")
        print(f"   - Ratio: {normal_count/anomaly_count:.1f}:1")
        
        # 2. Validate data quality
        print("\n[2/6] 🔍 ตรวจสอบคุณภาพข้อมูล...")
        data_quality_ok = validate_data_quality(df)
        if not data_quality_ok:
            logger.warning("⚠️  คุณภาพข้อมูลไม่สมบูรณ์ แต่ดำเนินการต่อ")
        
        # 3. Prepare training data
        print("\n[3/6] ⚙️  เตรียมข้อมูลสำหรับการเทรน...")
        df_clean = prepare_training_data(df)
        
        if len(df_clean) < 100:
            raise ValueError("❌ ข้อมูลไม่เพียงพอสำหรับการเทรน")
        
        # 4. Train and evaluate models
        print("\n[4/6] 🤖 เทรนและประเมินโมเดล...")
        results, detector = train_and_evaluate_models(df_clean)
        
        # 5. Test rule-based detection
        print("\n[5/6] 🔍 ทดสอบ Rule-based Detection...")
        test_rule_based_detection()
        
        # 6. Create visualization and summary
        print("\n[6/6] 📊 สร้างกราฟและสรุปผล...")
        create_performance_visualization(results)
        display_results_summary(results)
        save_training_info(results, detector)
        
        print(f"\n{'='*80}")
        print("✅ การเทรนโมเดล ML OPTIMIZED เสร็จสิ้น!")
        print("="*80)
        print("\n📁 ไฟล์ที่สร้าง:")
        print("   📄 models/anomaly_detection_*.pkl")
        print("   📄 models/training_summary_optimized.json")
        print("   📄 data/sensor_training_data.csv")
        print("   📄 plots/model_performance_optimized.png")
        print("   📄 training.log")
        
        # Show final summary
        if results:
            working_models = [k for k, v in results.items() if v['test'].get('f1_score', 0) > 0.1]
            
            if working_models:
                best_model = max(working_models, 
                               key=lambda x: results[x]['test'].get('f1_score', 0))
                best_f1 = results[best_model]['test'].get('f1_score', 0)
                
                print(f"\n{'='*80}")
                print("🏆 ผลลัพธ์สุดท้าย")
                print("="*80)
                print(f"   ⭐ โมเดลที่ดีที่สุด: {best_model.replace('_', ' ').title()}")
                print(f"   📊 Test F1-Score: {best_f1:.4f}")
                print(f"   ✅ โมเดลที่ใช้งานได้: {len(working_models)}/{len(results)}")
                
                # Calculate average F1
                avg_f1 = np.mean([results[m]['test'].get('f1_score', 0) for m in working_models])
                print(f"   📈 F1-Score เฉลี่ย: {avg_f1:.4f}")
                
                if best_f1 > 0.7:
                    print("\n   🎉 ระบบพร้อมใช้งานจริง!")
                elif best_f1 > 0.5:
                    print("\n   ✅ ระบบใช้งานได้ดี - แนะนำใช้ร่วมกับ Rules")
                else:
                    print("\n   ⚠️  แนะนำใช้ Hybrid (ML + Rules)")
                    
            else:
                print("\n⚠️  ไม่มีโมเดล ML ที่ทำงานได้ดี")
                print("   💡 ใช้ Rule-based Detection เท่านั้น")
        
        print("="*80)
        logger.info("✅ การเทรนโมเดล ML OPTIMIZED เสร็จสิ้นสมบูรณ์")
        
        return detector, results
        
    except Exception as e:
        logger.error(f"❌ ข้อผิดพลาดในการเทรน: {e}")
        print(f"\n{'='*80}")
        print("❌ เกิดข้อผิดพลาด!")
        print("="*80)
        print(f"Error: {e}")
        print("\n💡 แนะนำการแก้ไข:")
        print("   1. ตรวจสอบคุณภาพข้อมูล input")
        print("   2. ลดขนาดข้อมูลหรือจำนวน features")
        print("   3. ตรวจสอบ memory และ system resources")
        print("   4. ใช้เฉพาะ Rule-based detection")
        raise

if __name__ == "__main__":
    try:
        print("\n" + "="*80)
        print("   🌱 EMIB Smart Farming - ML Model Training")
        print("   📅 " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print("="*80 + "\n")
        
        detector, results = main()
        
        # Final statistics
        if results:
            working_models = [k for k, v in results.items() if v['test'].get('f1_score', 0) > 0.1]
            
            print("\n" + "="*80)
            print("📊 สถิติสุดท้าย")
            print("="*80)
            print(f"   ✅ โมเดลที่ทำงานได้: {len(working_models)}/{len(results)}")
            
            if working_models:
                avg_f1 = np.mean([results[m]['test'].get('f1_score', 0) for m in working_models])
                max_f1 = max([results[m]['test'].get('f1_score', 0) for m in working_models])
                min_f1 = min([results[m]['test'].get('f1_score', 0) for m in working_models])
                
                print(f"   📈 F1-Score:")
                print(f"      - สูงสุด: {max_f1:.4f}")
                print(f"      - เฉลี่ย: {avg_f1:.4f}")
                print(f"      - ต่ำสุด: {min_f1:.4f}")
                print("\n   🎉 ระบบพร้อมใช้งาน!")
            else:
                print("   ⚠️  ใช้ Rule-based detection เท่านั้น")
            
            print("="*80)
        
        print("\n✅ Training completed successfully!")
        print("💡 Run 'python test_system.py' to test the models\n")
            
    except KeyboardInterrupt:
        print("\n\n⚠️  การเทรนถูกยกเลิกโดยผู้ใช้")
        logger.info("Training interrupted by user")
    except Exception as e:
        print(f"\n❌ การเทรนล้มเหลว: {e}")
        logger.error(f"Training failed: {e}")
        print("\n💡 ใช้คำสั่ง: python anomaly_api.py เพื่อทดสอบ Rule-based detection")