import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
import seaborn as sns
from data_generator import SensorDataGenerator
from anomaly_models import AnomalyDetectionModels, RuleBasedAnomalyDetector
import os
import warnings
warnings.filterwarnings('ignore')

def load_or_generate_data():
    """โหลดหรือสร้างข้อมูลสำหรับเทรน"""
    data_file = "data/sensor_training_data.csv"
    
    if os.path.exists(data_file):
        print("📂 โหลดข้อมูลจากไฟล์...")
        df = pd.read_csv(data_file)
    else:
        print("🔄 สร้างข้อมูลใหม่...")
        generator = SensorDataGenerator()
        df = generator.generate_training_dataset(days=30, normal_ratio=0.75)  # 30 วัน, 75% ปกติ
        generator.save_dataset(df, "sensor_training_data.csv")
    
    return df

def main():
    print("🚀 เริ่มต้นการเทรนโมเดล Anomaly Detection")
    print("=" * 50)
    
    # สร้าง directories
    os.makedirs("data", exist_ok=True)
    os.makedirs("models", exist_ok=True)
    os.makedirs("plots", exist_ok=True)
    
    # 1. โหลดข้อมูล
    df = load_or_generate_data()
    print(f"📊 ข้อมูลทั้งหมด: {len(df)} รายการ")
    print(f"📈 ข้อมูลปกติ: {len(df[df['is_anomaly'] == 0])} รายการ")
    print(f"⚠️ ข้อมูลผิดปกติ: {len(df[df['is_anomaly'] == 1])} รายการ")
    
    # 2. เตรียมข้อมูล
    print("\n" + "="*50)
    print("🔧 เตรียมข้อมูลสำหรับการเทรน...")
    
    anomaly_detector = AnomalyDetectionModels()
    df_prepared, feature_columns = anomaly_detector.prepare_data(df)
    
    # แยก features และ labels
    X = df_prepared[feature_columns].values
    y = df_prepared['is_anomaly'].values
    
    print(f"🔧 Features: {len(feature_columns)} คอลัมน์")
    print(f"📏 ขนาดข้อมูล: {X.shape}")
    
    # 3. แบ่งข้อมูล train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"🎯 ข้อมูลเทรน: {len(X_train)} รายการ")
    print(f"🧪 ข้อมูลเทสต์: {len(X_test)} รายการ")
    
    # 4. เทรนโมเดลต่างๆ
    print("\n" + "="*50)
    print("🏃‍♂️ เริ่มเทรนโมเดล...")
    
    results = {}
    
    # 4.1 Isolation Forest
    try:
        print("\n🌲 เทรน Isolation Forest...")
        anomaly_detector.train_isolation_forest(X_train, y_train)
        results['isolation_forest'] = anomaly_detector.evaluate_model(
            X_test, y_test, 'isolation_forest'
        )
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเทรน Isolation Forest: {e}")
    
    # 4.2 One-Class SVM
    try:
        print("\n⚙️ เทรน One-Class SVM...")
        anomaly_detector.train_one_class_svm(X_train, y_train)
        results['one_class_svm'] = anomaly_detector.evaluate_model(
            X_test, y_test, 'one_class_svm'
        )
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเทรน One-Class SVM: {e}")
    
    # 4.3 Ensemble Model
    try:
        print("\n🎯 เทรน Ensemble Model...")
        anomaly_detector.train_ensemble_model(X_train, y_train)
        results['ensemble'] = anomaly_detector.evaluate_model(
            X_test, y_test, 'ensemble'
        )
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเทรน Ensemble Model: {e}")
    
    # 5. บันทึกโมเดล
    print("\n" + "="*50)
    print("💾 บันทึกโมเดล...")
    anomaly_detector.save_models("models/anomaly_detection")
    
    # 6. แสดงผลการเปรียบเทียบ
    print("\n" + "="*50)
    print("📊 สรุปผลการประเมิน:")
    
    comparison_data = []
    for model_name, result in results.items():
        report = result['classification_report']
        
        # ดึงเมตริกสำหรับ anomaly class (class 1)
        anomaly_precision = report['1']['precision']
        anomaly_recall = report['1']['recall']
        anomaly_f1 = report['1']['f1-score']
        accuracy = report['accuracy']
        
        comparison_data.append({
            'Model': model_name,
            'Accuracy': f"{accuracy:.4f}",
            'Precision (Anomaly)': f"{anomaly_precision:.4f}",
            'Recall (Anomaly)': f"{anomaly_recall:.4f}",
            'F1-Score (Anomaly)': f"{anomaly_f1:.4f}"
        })
        
        print(f"\n🔍 {model_name.upper()}:")
        print(f"  - Accuracy: {accuracy:.4f}")
        print(f"  - Precision (Anomaly): {anomaly_precision:.4f}")
        print(f"  - Recall (Anomaly): {anomaly_recall:.4f}")
        print(f"  - F1-Score (Anomaly): {anomaly_f1:.4f}")
    
    # สร้างตารางเปรียบเทียบ
    comparison_df = pd.DataFrame(comparison_data)
    print("\n📋 ตารางเปรียบเทียบ:")
    print(comparison_df.to_string(index=False))
    
    # 7. สร้างกราฟผลลัพธ์ (ถ้าติดตั้ง matplotlib ได้)
    try:
        print("\n📈 สร้างกราฟผลลัพธ์...")
        create_performance_plots(results)
        print("✅ บันทึกกราฟที่ plots/model_comparison.png")
    except Exception as e:
        print(f"⚠️ ไม่สามารถสร้างกราฟได้: {e}")
    
    # 8. ทดสอบ Rule-Based Detector
    print("\n" + "="*50)
    print("🔍 ทดสอบ Rule-Based Anomaly Detector...")
    
    rule_detector = RuleBasedAnomalyDetector()
    
    # สร้างข้อมูลตัวอย่างสำหรับทดสอบ
    test_cases = [
        {
            'name': 'ข้อมูลปกติ',
            'data': {
                'temperature': 25.0,
                'humidity': 60.0,
                'vpd': 1.2,
                'dew_point': 18.0,
                'voltage': 3.3,
                'battery_level': 85,
                'timestamp': '2024-01-01T12:00:00'
            }
        },
        {
            'name': 'VPD ต่ำ + Dew Point ใกล้',
            'data': {
                'temperature': 25.0,
                'humidity': 95.0,
                'vpd': 0.3,
                'dew_point': 24.5,
                'voltage': 3.3,
                'battery_level': 85,
                'timestamp': '2024-01-01T12:00:00'
            }
        },
        {
            'name': 'Voltage ต่ำ + แบตหมด',
            'data': {
                'temperature': 25.0,
                'humidity': 60.0,
                'vpd': 1.2,
                'dew_point': 18.0,
                'voltage': 2.5,
                'battery_level': 5,
                'timestamp': '2024-01-01T12:00:00'
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n🧪 ทดสอบ: {test_case['name']}")
        anomalies = rule_detector.detect_anomalies([test_case['data']])
        
        if anomalies:
            print("⚠️ พบความผิดปกติ:")
            for anomaly in anomalies:
                icon = "🔴" if anomaly['alert_level'] == 'red' else "⚠️"
                print(f"  {icon} {anomaly['type']}: {anomaly['message']}")
        else:
            print("✅ ไม่พบความผิดปกติ")
    
    print("\n🎉 การเทรนโมเดลเสร็จสิ้น!")
    print("📁 ไฟล์ที่สร้าง:")
    print("  - models/anomaly_detection_*.pkl (โมเดล ML)")
    print("  - data/sensor_training_data.csv (ข้อมูลเทรน)")
    print("  - plots/model_comparison.png (กราฟเปรียบเทียบ)")
    
    return anomaly_detector, results

def create_performance_plots(results):
    """สร้างกราฟเปรียบเทียบประสิทธิภาพ"""
    if not results:
        print("⚠️ ไม่มีผลลัพธ์ให้แสดงกราฟ")
        return
    
    # ตั้งค่า matplotlib
    plt.style.use('default')
    plt.rcParams['font.size'] = 10
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Model Performance Comparison', fontsize=16)
    
    models = list(results.keys())
    
    # เตรียมข้อมูลสำหรับกราฟ
    accuracies = []
    precisions = []
    recalls = []
    f1_scores = []
    
    for model in models:
        report = results[model]['classification_report']
        accuracies.append(report['accuracy'])
        precisions.append(report['1']['precision'])
        recalls.append(report['1']['recall'])
        f1_scores.append(report['1']['f1-score'])
    
    # กราฟ Accuracy
    axes[0,0].bar(models, accuracies, color='skyblue', alpha=0.7)
    axes[0,0].set_title('Accuracy Comparison')
    axes[0,0].set_ylabel('Accuracy')
    axes[0,0].set_ylim(0, 1)
    axes[0,0].tick_params(axis='x', rotation=45)
    
    # เพิ่มค่าบนแท่งกราฟ
    for i, v in enumerate(accuracies):
        axes[0,0].text(i, v + 0.01, f'{v:.3f}', ha='center', va='bottom')
    
    # กราฟ Precision
    axes[0,1].bar(models, precisions, color='lightcoral', alpha=0.7)
    axes[0,1].set_title('Precision (Anomaly Detection)')
    axes[0,1].set_ylabel('Precision')
    axes[0,1].set_ylim(0, 1)
    axes[0,1].tick_params(axis='x', rotation=45)
    
    for i, v in enumerate(precisions):
        axes[0,1].text(i, v + 0.01, f'{v:.3f}', ha='center', va='bottom')
    
    # กราฟ Recall
    axes[1,0].bar(models, recalls, color='lightgreen', alpha=0.7)
    axes[1,0].set_title('Recall (Anomaly Detection)')
    axes[1,0].set_ylabel('Recall')
    axes[1,0].set_ylim(0, 1)
    axes[1,0].tick_params(axis='x', rotation=45)
    
    for i, v in enumerate(recalls):
        axes[1,0].text(i, v + 0.01, f'{v:.3f}', ha='center', va='bottom')
    
    # กราฟ F1-Score
    axes[1,1].bar(models, f1_scores, color='gold', alpha=0.7)
    axes[1,1].set_title('F1-Score (Anomaly Detection)')
    axes[1,1].set_ylabel('F1-Score')
    axes[1,1].set_ylim(0, 1)
    axes[1,1].tick_params(axis='x', rotation=45)
    
    for i, v in enumerate(f1_scores):
        axes[1,1].text(i, v + 0.01, f'{v:.3f}', ha='center', va='bottom')
    
    plt.tight_layout()
    plt.savefig('plots/model_comparison.png', dpi=300, bbox_inches='tight')
    plt.close()  # ปิดกราฟเพื่อประหยัด memory

if __name__ == "__main__":
    detector, results = main()