import json
import pandas as pd
import numpy as np
import os
from datetime import datetime

def json_to_dataframe(json_file_path):
    """
    แปลงข้อมูลจากไฟล์ JSON เป็น DataFrame
    
    Args:
        json_file_path: ตำแหน่งของไฟล์ JSON
        
    Returns:
        DataFrame ที่พร้อมสำหรับการวิเคราะห์
    """
    # โหลดข้อมูลจากไฟล์ JSON
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # แปลงข้อมูลเป็น DataFrame
    if isinstance(data, list):
        # กรณีที่ JSON เป็น array ของข้อมูล (ตรงกับข้อมูลตัวอย่างของคุณ)
        df = pd.DataFrame(data)
    elif isinstance(data, dict):
        # กรณีที่ JSON มีโครงสร้างซับซ้อน
        if 'sensors' in data:
            df = pd.DataFrame(data['sensors'])
        elif 'data' in data:
            df = pd.DataFrame(data['data'])
        elif 'records' in data:
            df = pd.DataFrame(data['records'])
        else:
            # พยายามแปลงโดยตรง
            df = pd.DataFrame([data])
    else:
        raise ValueError(f"รูปแบบไฟล์ JSON ไม่รองรับ: {type(data)}")
    
    # ตรวจสอบว่ามีข้อมูลหรือไม่
    if df.empty:
        raise ValueError("ไม่พบข้อมูลในไฟล์ JSON หรือโครงสร้างข้อมูลไม่ตรงตามที่คาดหวัง")
        
    return df

def preprocess_data(df):
    """
    เตรียมข้อมูลให้อยู่ในรูปแบบที่ตรงกับโมเดล
    
    Args:
        df: DataFrame ที่โหลดจากไฟล์ JSON
        
    Returns:
        DataFrame ที่ปรับโครงสร้างแล้ว
    """
    # ตรวจสอบและปรับชื่อคอลัมน์ให้ตรงกับรูปแบบที่ต้องการ
    column_mapping = {
        # ปรับตามโครงสร้างข้อมูลของคุณ
        'vpo': 'vpd',      # จากตัวอย่างที่คุณส่งมา
        'ec': 'EC',        # บางรายการมี ec ตัวเล็ก บางรายการเป็น EC
        'co2': 'CO2',      # บางรายการมี co2 ตัวเล็ก บางรายการเป็น CO2
    }
    
    # เปลี่ยนชื่อคอลัมน์
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename(columns={old_name: new_name})
    
    # ทำให้ชื่อคอลัมน์เป็นตัวพิมพ์เล็กทั้งหมดเพื่อความคงที่
    df.columns = [col.lower() for col in df.columns]
    
    # ตรวจสอบว่ามีคอลัมน์จำเป็นครบหรือไม่
    # ปรับตามข้อมูลของคุณ - คุณมี temp, humidity, vpd (vpo), dew_point, EC, pH, CO2
    required_columns = ['timestamp', 'temperature', 'humidity', 'vpd', 'dew_point']
    
    # เพิ่มคอลัมน์ sensor_id ถ้าไม่มี (ในข้อมูลตัวอย่างไม่มี)
    if 'sensor_id' not in df.columns:
        df['sensor_id'] = 'greenhouse-01'  # ให้ค่าเริ่มต้น
    
    # เติมค่าจำเป็นที่ขาดหายไป
    for col in required_columns:
        if col not in df.columns:
            print(f"คำเตือน: ไม่พบคอลัมน์จำเป็น: {col} - เพิ่มคอลัมน์ว่าง")
            if col == 'timestamp':
                df[col] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            elif col == 'vpd' and 'temperature' in df.columns and 'humidity' in df.columns:
                # คำนวณ VPD จากอุณหภูมิและความชื้น
                df[col] = calculate_vpd_from_temp_humidity(df)
            elif col == 'dew_point' and 'temperature' in df.columns and 'humidity' in df.columns:
                # คำนวณ Dew Point จากอุณหภูมิและความชื้น
                df[col] = calculate_dew_point_from_temp_humidity(df)
            else:
                df[col] = np.nan
    
    # แปลง timestamp เป็นรูปแบบที่ถูกต้อง
    if 'timestamp' in df.columns:
        if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
            try:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
            except Exception as e:
                print(f"ไม่สามารถแปลงคอลัมน์ timestamp เป็น datetime ได้: {e}")
    
    # จัดการค่า null และ 0 (ที่อาจเป็นค่าผิดปกติตามที่คุณระบุ)
    df = detect_anomalies(df)
    
    return df

def calculate_vpd_from_temp_humidity(df):
    """คำนวณ Vapor Pressure Deficit (VPD) จากอุณหภูมิและความชื้น"""
    temp = df['temperature'].copy()
    humidity = df['humidity'].copy()
    
    # คำนวณเฉพาะแถวที่มีค่าทั้งอุณหภูมิและความชื้น
    valid_rows = ~(temp.isna() | humidity.isna())
    
    vpd = pd.Series(np.nan, index=df.index)
    
    # SVP (Saturated Vapor Pressure) = 0.61078 * exp(17.27 * T / (T + 237.3))
    # VPD = SVP * (1 - RH/100)
    svp = 0.61078 * np.exp(17.27 * temp[valid_rows] / (temp[valid_rows] + 237.3))
    vpd[valid_rows] = svp * (1 - humidity[valid_rows] / 100)
    
    return vpd

def calculate_dew_point_from_temp_humidity(df):
    """คำนวณ Dew Point จากอุณหภูมิและความชื้น"""
    temp = df['temperature'].copy()
    humidity = df['humidity'].copy()
    
    # คำนวณเฉพาะแถวที่มีค่าทั้งอุณหภูมิและความชื้น
    valid_rows = ~(temp.isna() | humidity.isna())
    
    dew_point = pd.Series(np.nan, index=df.index)
    
    # สูตรคำนวณ Dew Point
    numerator = 243.04 * (np.log(humidity[valid_rows] / 100) + 
                          ((17.625 * temp[valid_rows]) / (243.04 + temp[valid_rows])))
    denominator = 17.625 - np.log(humidity[valid_rows] / 100) - \
                  ((17.625 * temp[valid_rows]) / (243.04 + temp[valid_rows]))
    
    dew_point[valid_rows] = numerator / denominator
    
    return dew_point

def detect_anomalies(df):
    """
    ตรวจหาความผิดปกติในข้อมูล (ค่า null หรือค่า 0 ที่ไม่สมเหตุสมผล)
    
    Args:
        df: DataFrame ที่ต้องการตรวจหาความผิดปกติ
        
    Returns:
        DataFrame ที่มีคอลัมน์ anomaly และ anomaly_type เพิ่มเติม
    """
    # สร้างคอลัมน์ anomaly และ anomaly_type
    df['anomaly'] = 'normal'
    df['anomaly_type'] = None
    
    # 1. ความผิดปกติประเภท null values ในคอลัมน์สำคัญ
    key_columns = ['temperature', 'humidity', 'vpd', 'dew_point']
    
    # ตรวจสอบค่า null ในคอลัมน์สำคัญ
    for col in key_columns:
        if col in df.columns:
            mask_null = df[col].isna()
            df.loc[mask_null, 'anomaly'] = 'anomaly'
            df.loc[mask_null, 'anomaly_type'] = f'missing_{col}_data'
    
    # 2. ความผิดปกติประเภทค่า 0 ที่ไม่ควรเป็น 0
    # ตรวจสอบค่า EC และ pH ที่เป็น 0
    if 'ec' in df.columns:
        mask_zero_ec = (df['ec'] == 0)
        df.loc[mask_zero_ec, 'anomaly'] = 'anomaly'
        df.loc[mask_zero_ec, 'anomaly_type'] = 'zero_ec_value'
    
    if 'ph' in df.columns:
        mask_zero_ph = (df['ph'] == 0)
        df.loc[mask_zero_ph, 'anomaly'] = 'anomaly'
        df.loc[mask_zero_ph, 'anomaly_type'] = 'zero_ph_value'
    
    # 3. ตรวจสอบความผิดปกติของค่าที่ไม่ควรติดลบ
    numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
    for col in numeric_columns:
        if col not in ['anomaly', 'anomaly_type']:
            mask_negative = (df[col] < 0)
            df.loc[mask_negative, 'anomaly'] = 'anomaly'
            df.loc[mask_negative, 'anomaly_type'] = f'negative_{col}_value'
    
    # 4. ตรวจสอบค่าที่เกินขอบเขตปกติ
    # อุณหภูมิ: โดยทั่วไปควรอยู่ระหว่าง 0-50°C สำหรับสภาพแวดล้อมทั่วไป
    if 'temperature' in df.columns:
        mask_temp_outlier = (df['temperature'] > 50) | (df['temperature'] < 0)
        df.loc[mask_temp_outlier, 'anomaly'] = 'anomaly'
        df.loc[mask_temp_outlier, 'anomaly_type'] = 'temperature_outlier'
    
    # ความชื้น: ควรอยู่ระหว่าง 0-100%
    if 'humidity' in df.columns:
        mask_humidity_outlier = (df['humidity'] > 100) | (df['humidity'] < 0)
        df.loc[mask_humidity_outlier, 'anomaly'] = 'anomaly'
        df.loc[mask_humidity_outlier, 'anomaly_type'] = 'humidity_outlier'
    
    # ค่า pH: โดยทั่วไปควรอยู่ระหว่าง 0-14
    if 'ph' in df.columns:
        mask_ph_outlier = (df['ph'] > 14) | (df['ph'] < 0)
        df.loc[mask_ph_outlier, 'anomaly'] = 'anomaly'
        df.loc[mask_ph_outlier, 'anomaly_type'] = 'ph_outlier'
    
    return df

def json_to_csv(json_file_path, csv_output_path):
    """
    แปลงไฟล์ JSON เป็น CSV ที่พร้อมสำหรับการวิเคราะห์
    
    Args:
        json_file_path: ตำแหน่งของไฟล์ JSON
        csv_output_path: ตำแหน่งที่ต้องการบันทึกไฟล์ CSV
        
    Returns:
        ตำแหน่งของไฟล์ CSV ที่สร้างขึ้น
    """
    print(f"กำลังแปลงไฟล์ JSON: {json_file_path}")
    
    try:
        # แปลงไฟล์ JSON เป็น DataFrame
        df = json_to_dataframe(json_file_path)
        
        # แสดงโครงสร้างข้อมูลเบื้องต้น
        print("\nโครงสร้างข้อมูลเบื้องต้น:")
        print(f"จำนวนแถว: {len(df)}")
        print(f"คอลัมน์: {df.columns.tolist()}")
        
        # เตรียมข้อมูล
        df = preprocess_data(df)
        
        # บันทึกเป็นไฟล์ CSV
        df.to_csv(csv_output_path, index=False)
        print(f"บันทึกเป็นไฟล์ CSV แล้วที่: {csv_output_path}")
        
        # แสดงตัวอย่างข้อมูล
        print("\nตัวอย่างข้อมูลที่แปลงแล้ว:")
        print(df.head())
        
        return csv_output_path
    
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการแปลงไฟล์ {json_file_path}: {str(e)}")
        # สร้างไฟล์ CSV ว่างเพื่อให้กระบวนการทำงานต่อไปได้
        pd.DataFrame().to_csv(csv_output_path, index=False)
        return csv_output_path

def process_json_files(json_dir, csv_dir):
    """
    แปลงไฟล์ JSON ทั้งหมดในโฟลเดอร์
    
    Args:
        json_dir: โฟลเดอร์ที่มีไฟล์ JSON
        csv_dir: โฟลเดอร์สำหรับเก็บไฟล์ CSV ที่แปลงแล้ว
    """
    # สร้างโฟลเดอร์ถ้ายังไม่มี
    if not os.path.exists(csv_dir):
        os.makedirs(csv_dir)
    
    # หาไฟล์ JSON ทั้งหมดในโฟลเดอร์
    json_files = [f for f in os.listdir(json_dir) if f.endswith('.json')]
    
    if not json_files:
        print(f"ไม่พบไฟล์ JSON ในโฟลเดอร์: {json_dir}")
        return []
    
    csv_files = []
    for json_file in json_files:
        json_path = os.path.join(json_dir, json_file)
        csv_file = json_file.replace('.json', '.csv')
        csv_path = os.path.join(csv_dir, csv_file)
        
        csv_output = json_to_csv(json_path, csv_path)
        csv_files.append(csv_output)
    
    return csv_files

def combine_csv_files(csv_files, output_file):
    """
    รวมไฟล์ CSV หลายไฟล์เป็นไฟล์เดียว
    
    Args:
        csv_files: รายการไฟล์ CSV ที่ต้องการรวม
        output_file: ไฟล์ผลลัพธ์
    """
    if not csv_files:
        print("ไม่มีไฟล์ CSV ให้รวม")
        return
    
    # อ่านไฟล์แรก
    combined_df = pd.read_csv(csv_files[0])
    
    # รวมไฟล์ที่เหลือ
    for file in csv_files[1:]:
        df = pd.read_csv(file)
        combined_df = pd.concat([combined_df, df], ignore_index=True)
    
    # บันทึกไฟล์รวม
    combined_df.to_csv(output_file, index=False)
    print(f"รวมไฟล์ CSV เรียบร้อยแล้วที่: {output_file}")
    
    return combined_df

def analyze_anomaly_statistics(df):
    """
    แสดงสถิติเกี่ยวกับความผิดปกติในข้อมูล
    
    Args:
        df: DataFrame ที่มีการระบุความผิดปกติแล้ว
    """
    print("\n=== สถิติความผิดปกติในข้อมูล ===")
    
    # จำนวนข้อมูลปกติและผิดปกติ
    anomaly_count = len(df[df['anomaly'] == 'anomaly'])
    normal_count = len(df[df['anomaly'] == 'normal'])
    total_count = len(df)
    
    print(f"จำนวนข้อมูลทั้งหมด: {total_count} แถว")
    print(f"จำนวนข้อมูลปกติ: {normal_count} แถว ({normal_count/total_count*100:.2f}%)")
    print(f"จำนวนข้อมูลผิดปกติ: {anomaly_count} แถว ({anomaly_count/total_count*100:.2f}%)")
    
    # ประเภทของความผิดปกติ
    if 'anomaly_type' in df.columns:
        anomaly_types = df[df['anomaly'] == 'anomaly']['anomaly_type'].value_counts()
        
        print("\nประเภทของความผิดปกติ:")
        for anomaly_type, count in anomaly_types.items():
            if anomaly_type is not None:  # ข้ามค่า None
                print(f"- {anomaly_type}: {count} แถว ({count/anomaly_count*100:.2f}%)")
    
    # สถิติของแต่ละคอลัมน์สำคัญ แยกตามข้อมูลปกติและผิดปกติ
    key_columns = ['temperature', 'humidity', 'vpd', 'dew_point', 'ec', 'ph', 'co2']
    
    for col in [c for c in key_columns if c in df.columns]:
        print(f"\nสถิติของคอลัมน์ {col}:")
        
        # ข้อมูลปกติ
        print("  ข้อมูลปกติ:")
        normal_stats = df[df['anomaly'] == 'normal'][col].describe()
        print(f"    จำนวน: {normal_stats['count']}")
        if normal_stats['count'] > 0:
            print(f"    ค่าเฉลี่ย: {normal_stats['mean']:.2f}")
            print(f"    ค่าต่ำสุด: {normal_stats['min']:.2f}")
            print(f"    ค่าสูงสุด: {normal_stats['max']:.2f}")
        
        # ข้อมูลผิดปกติ
        print("  ข้อมูลผิดปกติ:")
        anomaly_stats = df[df['anomaly'] == 'anomaly'][col].describe()
        print(f"    จำนวน: {anomaly_stats['count']}")
        if anomaly_stats['count'] > 0:
            print(f"    ค่าเฉลี่ย: {anomaly_stats['mean']:.2f}")
            print(f"    ค่าต่ำสุด: {anomaly_stats['min']:.2f}")
            print(f"    ค่าสูงสุด: {anomaly_stats['max']:.2f}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='แปลงข้อมูล JSON เป็น CSV สำหรับการวิเคราะห์')
    parser.add_argument('--input', '-i', required=True, help='ไฟล์ JSON หรือโฟลเดอร์ที่มีไฟล์ JSON')
    parser.add_argument('--output', '-o', default='data', help='โฟลเดอร์สำหรับเก็บไฟล์ CSV (default: data)')
    parser.add_argument('--anomaly-only', action='store_true', help='แยกไฟล์เฉพาะข้อมูลที่มีความผิดปกติ')
    
    args = parser.parse_args()
    
    if os.path.isdir(args.input):
        # แปลงทุกไฟล์ในโฟลเดอร์
        csv_files = process_json_files(args.input, args.output)
        
        if csv_files:
            # รวมไฟล์ CSV เป็นไฟล์เดียว
            combined_file = os.path.join(args.output, 'sensor_anomaly_data.csv')
            combine_csv_files(csv_files, combined_file)
            
            # อ่านไฟล์รวมเพื่อวิเคราะห์
            df = pd.read_csv(combined_file)
            
            # วิเคราะห์สถิติความผิดปกติ
            analyze_anomaly_statistics(df)
            
            # ถ้าต้องการแยกไฟล์เฉพาะข้อมูลที่มีความผิดปกติ
            if args.anomaly_only:
                anomaly_file = os.path.join(args.output, 'sensor_anomaly_only.csv')
                df[df['anomaly'] == 'anomaly'].to_csv(anomaly_file, index=False)
                print(f"สร้างไฟล์เฉพาะข้อมูลผิดปกติแล้วที่: {anomaly_file}")
            
            # แบ่งข้อมูลสำหรับการเทรนและทดสอบ
            # เพื่อให้แน่ใจว่ามีข้อมูลผิดปกติในชุดทดสอบด้วย
            # ใช้การแบ่งแบบ stratified
            df_normal = df[df['anomaly'] == 'normal']
            df_anomaly = df[df['anomaly'] == 'anomaly']
            
            # แบ่งข้อมูลปกติ 80% สำหรับเทรน
            train_normal = df_normal.sample(frac=0.8, random_state=42)
            test_normal = df_normal.drop(train_normal.index)
            
            # แบ่งข้อมูลผิดปกติ 80% สำหรับเทรน
            train_anomaly = df_anomaly.sample(frac=0.8, random_state=42)
            test_anomaly = df_anomaly.drop(train_anomaly.index)
            
            # รวมชุดเทรนและทดสอบ
            train_df = pd.concat([train_normal, train_anomaly])
            test_df = pd.concat([test_normal, test_anomaly])
            
            # สลับข้อมูล
            train_df = train_df.sample(frac=1, random_state=42).reset_index(drop=True)
            test_df = test_df.sample(frac=1, random_state=42).reset_index(drop=True)
            
            train_file = os.path.join(args.output, 'sensor_anomaly_train.csv')
            test_file = os.path.join(args.output, 'sensor_anomaly_test.csv')
            
            train_df.to_csv(train_file, index=False)
            test_df.to_csv(test_file, index=False)
            
            print(f"\nแบ่งข้อมูลเป็นชุดเทรนและทดสอบเรียบร้อยแล้ว:")
            print(f"- ชุดเทรน: {train_file}")
            print(f"  - ข้อมูลทั้งหมด: {len(train_df)} แถว")
            print(f"  - ข้อมูลปกติ: {len(train_df[train_df['anomaly'] == 'normal'])} แถว")
            print(f"  - ข้อมูลผิดปกติ: {len(train_df[train_df['anomaly'] == 'anomaly'])} แถว")
            print(f"- ชุดทดสอบ: {test_file}")
            print(f"  - ข้อมูลทั้งหมด: {len(test_df)} แถว")
            print(f"  - ข้อมูลปกติ: {len(test_df[test_df['anomaly'] == 'normal'])} แถว")
            print(f"  - ข้อมูลผิดปกติ: {len(test_df[test_df['anomaly'] == 'anomaly'])} แถว")
    
    elif os.path.isfile(args.input) and args.input.endswith('.json'):
        # แปลงไฟล์เดียว
        if not os.path.exists(args.output):
            os.makedirs(args.output)
        
        base_name = os.path.basename(args.input).replace('.json', '.csv')
        csv_path = os.path.join(args.output, base_name)
        
        json_to_csv(args.input, csv_path)
        
        # สร้างไฟล์สำหรับการเทรนและทดสอบ
        df = pd.read_csv(csv_path)
        
        # วิเคราะห์สถิติความผิดปกติ
        analyze_anomaly_statistics(df)
        
        # คัดลอกไฟล์เป็นชื่อที่โค้ดคาดหวัง
        combined_file = os.path.join(args.output, 'sensor_anomaly_data.csv')
        df.to_csv(combined_file, index=False)
        
        # ถ้าต้องการแยกไฟล์เฉพาะข้อมูลที่มีความผิดปกติ
        if args.anomaly_only:
            anomaly_file = os.path.join(args.output, 'sensor_anomaly_only.csv')
            df[df['anomaly'] == 'anomaly'].to_csv(anomaly_file, index=False)
            print(f"สร้างไฟล์เฉพาะข้อมูลผิดปกติแล้วที่: {anomaly_file}")
        
        # แบ่งข้อมูลแบบ stratified
        df_normal = df[df['anomaly'] == 'normal']
        df_anomaly = df[df['anomaly'] == 'anomaly']
        
        if len(df_normal) > 0 and len(df_anomaly) > 0:
            # แบ่งข้อมูลปกติ 80% สำหรับเทรน
            train_normal = df_normal.sample(frac=0.8, random_state=42)
            test_normal = df_normal.drop(train_normal.index)
            
            # แบ่งข้อมูลผิดปกติ 80% สำหรับเทรน
            train_anomaly = df_anomaly.sample(frac=0.8, random_state=42)
            test_anomaly = df_anomaly.drop(train_anomaly.index)
            
            # รวมชุดเทรนและทดสอบ
            train_df = pd.concat([train_normal, train_anomaly])
            test_df = pd.concat([test_normal, test_anomaly])
        else:
            # กรณีที่ไม่มีข้อมูลผิดปกติหรือไม่มีข้อมูลปกติ ใช้การแบ่งแบบปกติ
            train_df = df.sample(frac=0.8, random_state=42)
            test_df = df.drop(train_df.index)
        
        # สลับข้อมูล
        train_df = train_df.sample(frac=1, random_state=42).reset_index(drop=True)
        test_df = test_df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        train_file = os.path.join(args.output, 'sensor_anomaly_train.csv')
        test_file = os.path.join(args.output, 'sensor_anomaly_test.csv')
        
        train_df.to_csv(train_file, index=False)
        test_df.to_csv(test_file, index=False)
        
        print(f"\nแบ่งข้อมูลเป็นชุดเทรนและทดสอบเรียบร้อยแล้ว:")
        print(f"- ชุดเทรน: {train_file}")
        print(f"  - ข้อมูลทั้งหมด: {len(train_df)} แถว")
        print(f"  - ข้อมูลปกติ: {len(train_df[train_df['anomaly'] == 'normal'])} แถว")
        print(f"  - ข้อมูลผิดปกติ: {len(train_df[train_df['anomaly'] == 'anomaly'])} แถว")
        print(f"- ชุดทดสอบ: {test_file}")
        print(f"  - ข้อมูลทั้งหมด: {len(test_df)} แถว")
        print(f"  - ข้อมูลปกติ: {len(test_df[test_df['anomaly'] == 'normal'])} แถว")
        print(f"  - ข้อมูลผิดปกติ: {len(test_df[test_df['anomaly'] == 'anomaly'])} แถว")
    
    else:
        print(f"ไฟล์หรือโฟลเดอร์ไม่ถูกต้อง: {args.input}")

if __name__ == "__main__":
    main()