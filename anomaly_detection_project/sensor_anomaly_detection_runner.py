import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime

# นำเข้าคลาสจากไฟล์อื่น ๆ
from sensor_anomaly_detection_model import SensorAnomalyDetector
from sensor_data_visualizer import SensorDataVisualizer

def ensure_directory_exists(directory):
    """สร้างโฟลเดอร์ถ้ายังไม่มี"""
    if not os.path.exists(directory):
        os.makedirs(directory)

def main():
    # สร้างโฟลเดอร์สำหรับเก็บข้อมูลและผลลัพธ์
    data_dir = "data"
    results_dir = "results"
    
    ensure_directory_exists(data_dir)
    ensure_directory_exists(results_dir)
    
    # ตั้งค่าไฟล์ข้อมูล
    all_data_file = os.path.join(data_dir, "sensor_anomaly_data.csv")
    train_data_file = os.path.join(data_dir, "sensor_anomaly_train.csv")
    test_data_file = os.path.join(data_dir, "sensor_anomaly_test.csv")
    
    # ตรวจสอบว่ามีไฟล์ข้อมูลครบถ้วนหรือไม่
    if not (os.path.exists(all_data_file) and 
            os.path.exists(train_data_file) and 
            os.path.exists(test_data_file)):
        print("ไม่พบไฟล์ข้อมูลที่จำเป็น กรุณาแปลงข้อมูล JSON เป็น CSV ก่อน")
        print("คำสั่ง: python json_to_csv_converter.py --input your_file.json --output data")
        return
    
    # แสดงภาพรวมและวิเคราะห์ข้อมูล
    print("\n=== การวิเคราะห์และแสดงผลข้อมูล ===")
    visualizer = SensorDataVisualizer(all_data_file)
    
    # แสดงภาพรวมข้อมูล
    visualizer.show_data_overview()
    
    # สร้างโฟลเดอร์สำหรับเก็บกราฟ
    graphs_dir = os.path.join(results_dir, "graphs")
    ensure_directory_exists(graphs_dir)
    
    # แสดงกราฟสำคัญ
    print("\nกำลังสร้างกราฟวิเคราะห์ข้อมูล...")
    
    # ดึงรายการของคุณลักษณะที่สำคัญ
    df = pd.read_csv(all_data_file)
    important_features = [col for col in ['temperature', 'humidity', 'vpd', 'ec', 'ph', 'co2'] 
                         if col in df.columns]
    
    # วิเคราะห์คุณลักษณะสำคัญ
    for feature in important_features:
        visualizer.plot_time_series(feature=feature)
        visualizer.plot_feature_distribution(feature=feature)
    
    # แสดงเมทริกซ์สหสัมพันธ์
    visualizer.plot_correlation_matrix()
    
    # ฝึกฝนและประเมินโมเดล
    print("\n=== การฝึกฝนและประเมินโมเดล ===")
    detector = SensorAnomalyDetector()
    
    # ทำงานกระบวนการทั้งหมด
    results = detector.run_pipeline(
        train_file=train_data_file,
        test_file=test_data_file
    )
    
    # บันทึกผลการประเมิน
    results_file = os.path.join(results_dir, "model_evaluation_results.txt")
    with open(results_file, "w", encoding="utf-8") as f:
        f.write("=== ผลการประเมินโมเดล ===\n\n")
        
        for name, result in results.items():
            f.write(f"โมเดล: {name}\n")
            f.write(f"Classification Report:\n{result['classification_report']}\n")
            f.write("Confusion Matrix:\n")
            f.write(str(result['confusion_matrix']))
            f.write("\n\n" + "="*50 + "\n\n")
    
    print(f"\nบันทึกผลการประเมินลงในไฟล์ {results_file} เรียบร้อยแล้ว")
    
    print("\n=== การทำงานเสร็จสมบูรณ์ ===")
    print(f"กราฟและผลการวิเคราะห์ถูกบันทึกในโฟลเดอร์ {results_dir}")
    print("คุณสามารถนำผลลัพธ์ไปใช้ในการตรวจสอบและป้องกันความผิดปกติในระบบเซนเซอร์ได้ต่อไป")

if __name__ == "__main__":
    main()