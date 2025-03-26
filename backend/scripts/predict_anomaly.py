#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
สคริปต์สำหรับทำนายความผิดปกติของข้อมูลเซนเซอร์

การใช้งาน:
    python3 predict_anomaly.py --input input_data.json --model isolation_forest
"""

import os
import json
import pickle
import pandas as pd
from datetime import datetime
import numpy as np
import argparse
import sys
import traceback

def load_model(model_path, model_name):
    """โหลดโมเดลและ preprocessor จากไฟล์"""
    model_file = os.path.join(model_path, f"{model_name}_model.pkl")
    preprocessor_file = os.path.join(model_path, "preprocessor.pkl")
    feature_file = os.path.join(model_path, "feature_columns.json")
    
    if not (os.path.exists(model_file) and os.path.exists(preprocessor_file) and os.path.exists(feature_file)):
        raise FileNotFoundError(f"ไม่พบไฟล์โมเดลที่จำเป็นใน {model_path}")
    
    # โหลดโมเดล
    with open(model_file, 'rb') as f:
        model = pickle.load(f)
    
    # โหลด preprocessor
    with open(preprocessor_file, 'rb') as f:
        preprocessor = pickle.load(f)
    
    # โหลดชื่อคอลัมน์
    with open(feature_file, 'r') as f:
        feature_columns = json.load(f)
    
    return model, preprocessor, feature_columns

def standardize_column_names(data):
    """ปรับมาตรฐานชื่อคอลัมน์"""
    if isinstance(data, dict):
        # แก้ไขชื่อคอลัมน์ใน dictionary
        data_copy = data.copy()
        columns_to_check = {
            'EC': 'ec', 
            'pH': 'ph', 
            'CO2': 'co2',
            'TDS': 'tds',
            'ORP': 'orp',
            'Temp': 'temperature',
            'Humid': 'humidity'
        }
        
        for old_name, new_name in columns_to_check.items():
            if old_name in data_copy and new_name not in data_copy:
                data_copy[new_name] = data_copy[old_name]
        
        return data_copy
    elif isinstance(data, list):
        # แก้ไขชื่อคอลัมน์ในแต่ละ dictionary ในลิสต์
        return [standardize_column_names(item) for item in data]
    else:
        return data

def predict_anomaly(data, model, preprocessor, feature_columns):
    """ทำนายว่าข้อมูลเป็นความผิดปกติหรือไม่"""
    try:
        # แปลงข้อมูลเป็น DataFrame
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data.copy()
        
        # ตรวจสอบและเพิ่มคอลัมน์ที่ขาดหายไป
        for col in feature_columns:
            if col not in df.columns:
                df[col] = 0  # ใส่ค่าเริ่มต้น
        
        # เติม sensor_id ถ้าไม่มี
        if 'sensor_id' not in df.columns:
            df['sensor_id'] = 'GH001'  # ค่าเริ่มต้นที่ใช้ในการทดสอบ
        
        # เตรียมข้อมูลสำหรับการทำนาย
        input_features = [col for col in feature_columns if col in df.columns]
        input_features.append('sensor_id' if 'sensor_id' in df.columns else None)
        input_features = [f for f in input_features if f is not None]
        
        # เตรียมคุณลักษณะและทำนาย
        X = df[input_features]
        X_scaled = preprocessor.transform(X)
        predictions = model.predict(X_scaled)
        
        # คำนวณคะแนนความผิดปกติ
        anomaly_scores = None
        if hasattr(model, 'decision_function'):
            anomaly_scores = model.decision_function(X_scaled)
        elif hasattr(model, 'score_samples'):
            anomaly_scores = -model.score_samples(X_scaled)
        
        # สร้างผลลัพธ์
        results = []
        for i in range(len(df)):
            is_anomaly = predictions[i] == -1  # สำหรับ Isolation Forest และ One-Class SVM
            score = float(anomaly_scores[i]) if anomaly_scores is not None else None
            
            result = {
                'is_anomaly': bool(is_anomaly),
                'anomaly_score': score,
                'timestamp': df.iloc[i].get('timestamp', datetime.now().isoformat())
            }
            results.append(result)
        
        # ถ้ามีข้อมูลเพียงรายการเดียว ให้ส่งกลับเฉพาะรายการนั้น
        if len(results) == 1:
            return results[0]
        
        return results
        
    except Exception as e:
        error_msg = f"เกิดข้อผิดพลาดในการทำนาย: {str(e)}"
        print(error_msg, file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {
            'error': error_msg,
            'timestamp': datetime.now().isoformat()
        }

def main():
    """ฟังก์ชันหลัก"""
    # แยกวิเคราะห์ argument
    parser = argparse.ArgumentParser(description='ทำนายความผิดปกติของข้อมูลเซนเซอร์')
    parser.add_argument('--input', required=True, help='ไฟล์ข้อมูลเซนเซอร์ในรูปแบบ JSON')
    parser.add_argument('--model', default='isolation_forest', help='ชื่อของโมเดลที่ใช้ทำนาย')
    args = parser.parse_args()
    
    try:
        # โหลดข้อมูลเซนเซอร์
        with open(args.input, 'r') as f:
            sensor_data = json.load(f)
        
        # ปรับมาตรฐานชื่อคอลัมน์
        sensor_data = standardize_column_names(sensor_data)
        
        # โหลดโมเดล
        model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
        model, preprocessor, feature_columns = load_model(model_path, args.model)
        
        # ทำนายความผิดปกติ
        result = predict_anomaly(sensor_data, model, preprocessor, feature_columns)
        
        # ตรวจสอบผลลัพธ์
        if isinstance(result, dict) and 'error' in result:
            print(json.dumps(result), file=sys.stderr)
            sys.exit(1)
        
        # แสดงผลลัพธ์เป็น JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_msg = f"เกิดข้อผิดพลาด: {str(e)}"
        print(json.dumps({'error': error_msg, 'timestamp': datetime.now().isoformat()}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()