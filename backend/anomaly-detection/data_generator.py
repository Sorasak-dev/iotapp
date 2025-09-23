import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import os
import warnings
warnings.filterwarnings('ignore')

class SensorDataGenerator:
    def __init__(self):
        # ช่วงค่าที่ปรับปรุงให้แม่นยำและสมจริงขึ้น
        self.normal_ranges = {
            'temperature': {'min': 15, 'max': 40, 'optimal': 25, 'std': 2.5},
            'humidity': {'min': 25, 'max': 95, 'optimal': 65, 'std': 10.0},
            'co2': {'min': 300, 'max': 1800, 'optimal': 800, 'std': 180},
            'ec': {'min': 0.8, 'max': 2.8, 'optimal': 1.5, 'std': 0.35},
            'ph': {'min': 5.0, 'max': 8.0, 'optimal': 6.5, 'std': 0.6},
            'voltage': {'min': 2.8, 'max': 3.8, 'optimal': 3.3, 'std': 0.12},
            'battery_level': {'min': 15, 'max': 100, 'optimal': 80, 'std': 12}
        }
        
        # รูปแบบตามฤดูกาล - ปรับปรุงให้สมจริงขึ้น
        self.seasonal_patterns = {
            'summer': {'temp_offset': 4, 'humidity_offset': -10, 'co2_offset': 100},
            'winter': {'temp_offset': -6, 'humidity_offset': 8, 'co2_offset': -80},
            'rainy': {'temp_offset': -3, 'humidity_offset': 18, 'co2_offset': -50},
            'dry': {'temp_offset': 3, 'humidity_offset': -15, 'co2_offset': 120},
            'normal': {'temp_offset': 0, 'humidity_offset': 0, 'co2_offset': 0}
        }
        
        # แคช derived values เพื่อป้องกัน recalculation
        self._derived_cache = {}
        
    def _safe_numeric_operation(self, operation, *args, fallback=0.0):
        """ทำการคำนวณอย่างปลอดภัยป้องกัน overflow/underflow"""
        try:
            result = operation(*args)
            if not np.isfinite(result):
                return fallback
            return result
        except (ValueError, ZeroDivisionError, OverflowError, RuntimeWarning):
            return fallback
    
    def calculate_derived_values(self, temperature, humidity):
        """คำนวณค่าที่ได้มาจากอุณหภูมิและความชื้น - ปรับปรุงความเสถียร"""
        # สร้าง cache key
        cache_key = f"{temperature:.2f}_{humidity:.2f}"
        if cache_key in self._derived_cache:
            return self._derived_cache[cache_key]
        
        try:
            # ตรวจสอบและจำกัดค่า input
            if not all(isinstance(x, (int, float)) for x in [temperature, humidity]):
                return 0.0, 1.0
                
            safe_temp = np.clip(float(temperature), -30, 70)
            safe_humidity = np.clip(float(humidity), 1, 99.9)
            
            # Dew Point - ใช้สูตร Magnus ที่ปรับปรุง
            def calc_dew_point(temp, hum):
                if temp <= -40 or hum <= 0:
                    return temp - 10
                
                a, b = 17.625, 243.04  # ค่าคงที่ที่แม่นยำขึ้น
                alpha = np.log(hum / 100) + (a * temp) / (b + temp)
                dew_point = (b * alpha) / (a - alpha)
                return np.clip(dew_point, temp - 30, temp - 0.1)
            
            dew_point = self._safe_numeric_operation(
                calc_dew_point, safe_temp, safe_humidity, 
                fallback=safe_temp - 8
            )
            
            # VPD - ปรับปรุงการคำนวณ
            def calc_vpd(temp, hum):
                if temp <= -20 or hum <= 0 or hum >= 100:
                    return 1.0
                
                # คำนวณ saturation vapor pressure (kPa)
                svp = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
                avp = svp * (hum / 100)
                vpd_val = svp - avp
                return np.clip(vpd_val, 0.01, 8.0)
            
            vpd = self._safe_numeric_operation(
                calc_vpd, safe_temp, safe_humidity,
                fallback=1.0
            )
            
            # บันทึกใน cache
            result = (round(float(dew_point), 2), round(float(vpd), 3))
            self._derived_cache[cache_key] = result
            
            # จำกัดขนาด cache
            if len(self._derived_cache) > 1000:
                # ลบ cache เก่า 20%
                items_to_remove = list(self._derived_cache.keys())[:200]
                for key in items_to_remove:
                    del self._derived_cache[key]
            
            return result
            
        except Exception as e:
            print(f"Warning in calculate_derived_values: {e}")
            return 0.0, 1.0
    
    def add_realistic_noise(self, base_value, std_dev, bounds=None):
        """เพิ่ม noise ที่สมจริงและมีเสถียรภาพ"""
        try:
            if not np.isfinite(base_value) or not np.isfinite(std_dev):
                return bounds[0] if bounds else 0
            
            # ใช้ Gaussian noise แต่จำกัดที่ 3 sigma
            noise = np.random.normal(0, std_dev)
            noise = np.clip(noise, -3 * std_dev, 3 * std_dev)
            
            new_value = base_value + noise
            
            if bounds:
                new_value = np.clip(new_value, bounds[0], bounds[1])
            
            return float(new_value) if np.isfinite(new_value) else (bounds[0] if bounds else 0)
            
        except Exception:
            return bounds[0] if bounds else 0
    
    def add_time_patterns(self, base_temp, base_humidity, current_time, season='normal'):
        """เพิ่มรูปแบบตามเวลาที่ซับซ้อนและสมจริง"""
        try:
            hour = current_time.hour
            day_of_year = current_time.timetuple().tm_yday
            day_of_week = current_time.weekday()
            
            # รูปแบบรายวัน - ปรับให้เป็นธรรมชาติมากขึ้น
            daily_temp_factor = 1.2 if 10 <= hour <= 16 else 0.8  # เวลากลางวันร้อน
            daily_humidity_factor = 0.8 if 10 <= hour <= 16 else 1.2  # เวลากลางวันแห้ง
            
            daily_temp_cycle = 5 * np.sin((hour - 6) * np.pi / 12) * daily_temp_factor
            daily_humidity_cycle = -4 * np.sin((hour - 6) * np.pi / 12) * daily_humidity_factor
            
            # รูปแบบรายปี
            seasonal_temp_cycle = 10 * np.sin((day_of_year - 80) * 2 * np.pi / 365)
            seasonal_humidity_cycle = -6 * np.sin((day_of_year - 80) * 2 * np.pi / 365)
            
            # รูปแบบรายสัปดาห์ (อิทธิพลของกิจกรรมมนุษย์)
            weekly_factor = 0.8 if day_of_week >= 5 else 1.0  # วันหยุดมีความผันผวนน้อย
            
            # รวมทุกรูปแบบ
            total_temp_change = (daily_temp_cycle + seasonal_temp_cycle * 0.3) * weekly_factor
            total_humidity_change = (daily_humidity_cycle + seasonal_humidity_cycle * 0.3) * weekly_factor
            
            # เพิ่มความผันผวนแบบสุ่ม
            weather_noise = np.random.normal(0, 1.8)
            total_temp_change += weather_noise
            total_humidity_change += weather_noise * 0.7
            
            # ปรับตามฤดูกาล
            if season in self.seasonal_patterns:
                pattern = self.seasonal_patterns[season]
                total_temp_change += pattern['temp_offset']
                total_humidity_change += pattern['humidity_offset']
            
            # จำกัดการเปลี่ยนแปลงไม่ให้รุนแรงเกินไป
            total_temp_change = np.clip(total_temp_change, -18, 18)
            total_humidity_change = np.clip(total_humidity_change, -25, 25)
            
            return float(total_temp_change), float(total_humidity_change)
            
        except Exception:
            return 0.0, 0.0
    
    def generate_normal_data_enhanced(self, timestamp=None, season='normal'):
        """สร้างข้อมูลปกติที่มีคุณภาพสูงและมีเสถียรภาพ"""
        if timestamp is None:
            timestamp = datetime.now()
        
        try:
            # ดึงค่าพื้นฐาน
            temp_base = self.normal_ranges['temperature']['optimal']
            humidity_base = self.normal_ranges['humidity']['optimal']
            
            # เพิ่มรูปแบบตามเวลา
            temp_change, humidity_change = self.add_time_patterns(
                temp_base, humidity_base, timestamp, season
            )
            
            # สร้างค่าเซนเซอร์หลัก
            temperature = self.add_realistic_noise(
                temp_base + temp_change,
                self.normal_ranges['temperature']['std'],
                (self.normal_ranges['temperature']['min'], self.normal_ranges['temperature']['max'])
            )
            
            humidity = self.add_realistic_noise(
                humidity_base + humidity_change,
                self.normal_ranges['humidity']['std'],
                (self.normal_ranges['humidity']['min'], self.normal_ranges['humidity']['max'])
            )
            
            # เซนเซอร์อื่นๆ - มีความสัมพันธ์กับสภาพแวดล้อม
            co2_base = self.normal_ranges['co2']['optimal']
            seasonal_co2_offset = self.seasonal_patterns.get(season, {}).get('co2_offset', 0)
            
            # CO2 เปลี่ยนแปลงตามอุณหภูมิและเวลา
            if temperature > 32:
                co2_base += 250  # CO2 เพิ่มเมื่อร้อน
            if 6 <= timestamp.hour <= 18:
                co2_base -= 100  # CO2 ลดในเวลากลางวัน (photosynthesis)
            
            # สร้างข้อมูลทั้งหมด
            data = {
                'temperature': round(temperature, 2),
                'humidity': round(humidity, 2),
                'co2': round(self.add_realistic_noise(
                    co2_base + seasonal_co2_offset,
                    self.normal_ranges['co2']['std'],
                    (self.normal_ranges['co2']['min'], self.normal_ranges['co2']['max'])
                )),
                'ec': round(self.add_realistic_noise(
                    self.normal_ranges['ec']['optimal'],
                    self.normal_ranges['ec']['std'],
                    (self.normal_ranges['ec']['min'], self.normal_ranges['ec']['max'])
                ), 2),
                'ph': round(self.add_realistic_noise(
                    self.normal_ranges['ph']['optimal'],
                    self.normal_ranges['ph']['std'],
                    (self.normal_ranges['ph']['min'], self.normal_ranges['ph']['max'])
                ), 2),
                'voltage': round(self.add_realistic_noise(
                    self.normal_ranges['voltage']['optimal'],
                    self.normal_ranges['voltage']['std'],
                    (self.normal_ranges['voltage']['min'], self.normal_ranges['voltage']['max'])
                ), 2)
            }
            
            # Battery level - ลดลงตามเวลาอย่างสมจริง
            battery_decline = timestamp.hour * 0.3 + np.random.normal(0, 2)
            battery_base = max(20, self.normal_ranges['battery_level']['optimal'] - battery_decline)
            data['battery_level'] = round(self.add_realistic_noise(
                battery_base,
                self.normal_ranges['battery_level']['std'],
                (self.normal_ranges['battery_level']['min'], 100)
            ))
            
            # คำนวณค่าที่ได้มา
            dew_point, vpd = self.calculate_derived_values(data['temperature'], data['humidity'])
            data['dew_point'] = dew_point
            data['vpd'] = vpd
            data['timestamp'] = timestamp.isoformat()
            
            return data
            
        except Exception as e:
            print(f"Error in generate_normal_data_enhanced: {e}")
            # Return safe fallback data
            return {
                'temperature': 25.0,
                'humidity': 65.0,
                'co2': 800,
                'ec': 1.5,
                'ph': 6.5,
                'voltage': 3.3,
                'battery_level': 80,
                'dew_point': 18.0,
                'vpd': 1.0,
                'timestamp': timestamp.isoformat()
            }
    
    def generate_edge_case_normal_data(self, count=1000):
        """สร้างข้อมูลปกติที่อยู่ใกล้ขอบเขต - ปรับปรุงแล้ว"""
        edge_data = []
        
        # สร้าง edge case patterns ที่หลากหลายขึ้น
        edge_patterns = [
            # VPD ขอบเขตต่ำ
            {'temp_range': (18, 25), 'humidity_range': (88, 94), 'type': 'high_humidity'},
            # Voltage ขอบเขตต่ำ  
            {'voltage_range': (2.85, 3.05), 'battery_range': (20, 35), 'type': 'low_power'},
            # อุณหภูมิสูง
            {'temp_range': (35, 39), 'humidity_range': (30, 40), 'type': 'hot_dry'},
            # ความชื้นต่ำ
            {'temp_range': (28, 35), 'humidity_range': (25, 35), 'type': 'dry_condition'},
            # CO2 สูง
            {'co2_range': (1400, 1700), 'type': 'high_co2'},
            # pH ขอบเขต
            {'ph_range': (5.1, 5.5), 'ec_range': (2.2, 2.7), 'type': 'acidic'},
        ]
        
        for i in range(count):
            try:
                pattern = random.choice(edge_patterns)
                timestamp = datetime.now() - timedelta(minutes=random.randint(0, 43200))
                
                # สร้างข้อมูลพื้นฐาน
                data = self.generate_normal_data_enhanced(timestamp)
                
                # ปรับค่าตาม pattern
                if 'temp_range' in pattern:
                    data['temperature'] = round(random.uniform(*pattern['temp_range']), 2)
                if 'humidity_range' in pattern:
                    data['humidity'] = round(random.uniform(*pattern['humidity_range']), 2)
                if 'voltage_range' in pattern:
                    data['voltage'] = round(random.uniform(*pattern['voltage_range']), 2)
                if 'battery_range' in pattern:
                    data['battery_level'] = round(random.uniform(*pattern['battery_range']))
                if 'co2_range' in pattern:
                    data['co2'] = round(random.uniform(*pattern['co2_range']))
                if 'ph_range' in pattern:
                    data['ph'] = round(random.uniform(*pattern['ph_range']), 2)
                if 'ec_range' in pattern:
                    data['ec'] = round(random.uniform(*pattern['ec_range']), 2)
                
                # คำนวณค่าที่ได้มาใหม่
                dew_point, vpd = self.calculate_derived_values(data['temperature'], data['humidity'])
                data['dew_point'] = dew_point
                data['vpd'] = vpd
                data['anomaly_type'] = 'normal'
                data['is_anomaly'] = 0
                
                edge_data.append(data)
                
            except Exception as e:
                print(f"Error in edge case generation {i}: {e}")
                continue
        
        return edge_data
    
    def generate_sophisticated_anomalies(self, count=200, anomaly_types=None):
        """สร้างข้อมูลผิดปกติที่ซับซ้อนและสมจริง - ปรับปรุงแล้ว"""
        if anomaly_types is None:
            anomaly_types = [
                'sudden_drop', 'sudden_spike', 'vpd_too_low', 'low_voltage',
                'dew_point_close', 'battery_depleted', 'sensor_failure',
                'high_fluctuation', 'gradual_drift', 'multi_sensor_failure',
                'environmental_stress', 'power_surge', 'calibration_drift'
            ]
        
        anomaly_data = []
        
        for i in range(count):
            try:
                anomaly_type = random.choice(anomaly_types)
                timestamp = datetime.now() - timedelta(minutes=random.randint(0, 43200))
                
                # เริ่มจากข้อมูลปกติ
                data = self.generate_normal_data_enhanced(timestamp)
                
                # ปรับค่าตามประเภท anomaly
                if anomaly_type == 'sudden_drop':
                    drop_factor = random.uniform(0.3, 0.8)
                    data['temperature'] = max(data['temperature'] * drop_factor, -5)
                    data['voltage'] = max(data['voltage'] * 0.6, 1.8)
                    
                elif anomaly_type == 'sudden_spike':
                    spike_factor = random.uniform(1.4, 2.2)
                    data['temperature'] = min(data['temperature'] * spike_factor, 65)
                    data['voltage'] = min(data['voltage'] * 1.3, 4.8)
                    
                elif anomaly_type == 'vpd_too_low':
                    data['humidity'] = random.uniform(92, 99)
                    data['temperature'] = random.uniform(15, 25)
                    
                elif anomaly_type == 'low_voltage':
                    data['voltage'] = random.uniform(1.5, 2.6)
                    data['battery_level'] = random.uniform(0, 20)
                    
                elif anomaly_type == 'dew_point_close':
                    data['humidity'] = random.uniform(95, 99)
                    temp = random.uniform(18, 28)
                    data['temperature'] = temp
                    
                elif anomaly_type == 'battery_depleted':
                    data['battery_level'] = random.uniform(0, 8)
                    data['voltage'] = random.uniform(1.2, 2.3)
                    
                elif anomaly_type == 'sensor_failure':
                    # เลือก sensor ที่จะเสียแบบสุ่ม
                    failing_sensors = random.sample(
                        ['temperature', 'humidity', 'co2', 'voltage'], 
                        random.randint(1, 3)
                    )
                    failure_values = [-999, 0, 9999, -1]
                    for sensor in failing_sensors:
                        data[sensor] = random.choice(failure_values)
                        
                elif anomaly_type == 'high_fluctuation':
                    # ความผันผวนสูงในหลายเซนเซอร์
                    fluctuation = random.uniform(10, 25)
                    data['temperature'] += random.choice([-fluctuation, fluctuation])
                    data['humidity'] += random.uniform(-20, 20)
                    data['voltage'] += random.uniform(-0.8, 0.8)
                    
                elif anomaly_type == 'gradual_drift':
                    # Drift ที่ค่อยเป็นค่อยไป
                    drift_amount = random.uniform(8, 20)
                    data['temperature'] = min(data['temperature'] + drift_amount, 60)
                    data['ec'] += random.uniform(0.8, 2.0)
                    data['ph'] += random.uniform(1.5, 3.0)
                    
                elif anomaly_type == 'multi_sensor_failure':
                    # หลายเซนเซอร์เสียพร้อมกัน
                    data.update({
                        'temperature': -999,
                        'humidity': 0,
                        'voltage': 0,
                        'battery_level': 0,
                        'co2': -999
                    })
                    
                elif anomaly_type == 'environmental_stress':
                    # สถานการณ์สิ่งแวดล้อมรุนแรง
                    stress_scenarios = [
                        {'temperature': random.uniform(42, 50), 'humidity': random.uniform(15, 25)},
                        {'temperature': random.uniform(8, 15), 'humidity': random.uniform(95, 99)},
                        {'co2': random.uniform(2000, 2500), 'temperature': random.uniform(35, 42)}
                    ]
                    scenario = random.choice(stress_scenarios)
                    data.update(scenario)
                    
                elif anomaly_type == 'power_surge':
                    # กระแสไฟกระชาก
                    data['voltage'] = random.uniform(4.2, 5.0)
                    data['battery_level'] = random.uniform(95, 100)
                    
                elif anomaly_type == 'calibration_drift':
                    # การเบี่ยงเบนของการสอบเทียบ
                    drift_sensors = ['ec', 'ph', 'co2']
                    for sensor in drift_sensors:
                        if sensor in data:
                            offset = random.uniform(0.5, 2.0) * random.choice([-1, 1])
                            data[sensor] += offset
                
                # คำนวณค่าที่ได้มาใหม่ (ถ้าข้อมูลยังใช้ได้)
                if (data['temperature'] > -100 and 0 < data['humidity'] <= 100):
                    dew_point, vpd = self.calculate_derived_values(
                        data['temperature'], data['humidity']
                    )
                    data['dew_point'] = dew_point
                    data['vpd'] = vpd
                else:
                    data['dew_point'] = 0
                    data['vpd'] = 0
                
                # ตรวจสอบค่าสุดท้าย
                for key, value in data.items():
                    if key not in ['timestamp', 'anomaly_type', 'is_anomaly']:
                        if isinstance(value, (int, float)) and not np.isfinite(value):
                            data[key] = 0
                
                data['anomaly_type'] = anomaly_type
                data['is_anomaly'] = 1
                anomaly_data.append(data)
                
            except Exception as e:
                print(f"Error in anomaly generation {i}: {e}")
                continue
        
        return anomaly_data
    
    def generate_comprehensive_dataset_enhanced(self, days=90, normal_ratio=0.80):
        """สร้างชุดข้อมูลที่มีคุณภาพสูงและสมจริง - ปรับปรุงแล้ว"""
        print(f"สร้างข้อมูลคุณภาพสูง {days} วัน (อัตราปกติ {normal_ratio*100:.0f}%)")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        all_data = []
        
        # คำนวณจำนวนข้อมูล
        total_points = int(days * 24 * 6)  # ทุก 10 นาที
        normal_points = int(total_points * normal_ratio)
        anomaly_points = total_points - normal_points
        edge_case_points = int(normal_points * 0.25)  # 25% ของข้อมูลปกติเป็น edge cases
        regular_normal_points = normal_points - edge_case_points
        
        print(f"  - ข้อมูลปกติทั่วไป: {regular_normal_points:,}")
        print(f"  - ข้อมูลปกติขอบเขต: {edge_case_points:,}")
        print(f"  - ข้อมูลผิดปกติ: {anomaly_points:,}")
        
        # สร้างข้อมูลปกติทั่วไป - กระจายตามเวลาจริง
        seasons = ['normal', 'summer', 'winter', 'rainy', 'dry']
        current_time = start_date
        time_increment = timedelta(minutes=10)
        
        for i in range(regular_normal_points):
            try:
                season = random.choice(seasons)
                data = self.generate_normal_data_enhanced(current_time, season)
                data['anomaly_type'] = 'normal'
                data['is_anomaly'] = 0
                all_data.append(data)
                current_time += time_increment
            except Exception as e:
                print(f"Error generating normal data {i}: {e}")
                continue
        
        # สร้างข้อมูลปกติขอบเขต
        print("สร้างข้อมูลขอบเขต...")
        edge_data = self.generate_edge_case_normal_data(edge_case_points)
        all_data.extend(edge_data)
        
        # สร้างข้อมูลผิดปกติ
        print("สร้างข้อมูลผิดปกติ...")
        anomaly_data = self.generate_sophisticated_anomalies(anomaly_points)
        all_data.extend(anomaly_data)
        
        # สร้าง DataFrame
        df = pd.DataFrame(all_data)
        
        # ทำความสะอาดข้อมูลขั้นสุดท้าย
        numeric_columns = ['temperature', 'humidity', 'co2', 'ec', 'ph', 'voltage', 'battery_level', 'dew_point', 'vpd']
        
        for col in numeric_columns:
            if col in df.columns:
                # แทนที่ infinity values
                df[col] = df[col].replace([np.inf, -np.inf], np.nan)
                
                # จัดการ error codes สำหรับข้อมูลปกติ
                error_codes = [-999, -1, 9999]
                for error_code in error_codes:
                    mask = (df['is_anomaly'] == 0) & (df[col] == error_code)
                    df.loc[mask, col] = np.nan
                
                # จำกัดค่าให้อยู่ในช่วงสมเหตุสมผล (เฉพาะข้อมูลปกติ)
                if col == 'vpd':
                    normal_mask = df['is_anomaly'] == 0
                    df.loc[normal_mask, col] = df.loc[normal_mask, col].apply(
                        lambda x: np.clip(x, 0, 8) if pd.notnull(x) else 1.0
                    )
                elif col == 'temperature':
                    normal_mask = df['is_anomaly'] == 0
                    df.loc[normal_mask, col] = df.loc[normal_mask, col].apply(
                        lambda x: np.clip(x, -30, 70) if pd.notnull(x) else 25.0
                    )
                elif col == 'humidity':
                    normal_mask = df['is_anomaly'] == 0
                    df.loc[normal_mask, col] = df.loc[normal_mask, col].apply(
                        lambda x: np.clip(x, 0, 100) if pd.notnull(x) else 65.0
                    )
                elif col == 'voltage':
                    normal_mask = df['is_anomaly'] == 0
                    df.loc[normal_mask, col] = df.loc[normal_mask, col].apply(
                        lambda x: np.clip(x, 0, 5) if pd.notnull(x) else 3.3
                    )
                
                # เติมค่าที่หายไปด้วย median ของข้อมูลปกติ
                normal_data_median = df[df['is_anomaly'] == 0][col].median()
                if pd.isna(normal_data_median):
                    fallback_values = {
                        'temperature': 25.0, 'humidity': 65.0, 'voltage': 3.3,
                        'battery_level': 80.0, 'co2': 800.0, 'ec': 1.5,
                        'ph': 6.5, 'dew_point': 18.0, 'vpd': 1.0
                    }
                    normal_data_median = fallback_values.get(col, 0)
                
                df[col] = df[col].fillna(normal_data_median)
        
        # สุ่มข้อมูลและ reset index
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        print(f"\nสร้างข้อมูลเสร็จสิ้น: {len(df):,} รายการ")
        print(f"ข้อมูลปกติ: {len(df[df['is_anomaly'] == 0]):,} รายการ ({len(df[df['is_anomaly'] == 0])/len(df)*100:.1f}%)")
        print(f"ข้อมูลผิดปกติ: {len(df[df['is_anomaly'] == 1]):,} รายการ ({len(df[df['is_anomaly'] == 1])/len(df)*100:.1f}%)")
        
        return df
    
    def save_dataset(self, df, filename="enhanced_sensor_data.csv"):
        """บันทึกข้อมูลพร้อมสถิติรายละเอียด"""
        os.makedirs("data", exist_ok=True)
        
        filepath = f"data/{filename}"
        df.to_csv(filepath, index=False)
        
        print(f"\nบันทึกข้อมูลลงไฟล์: {filepath}")
        print("="*60)
        print("สถิติข้อมูลรายละเอียด:")
        print(f"  - รายการทั้งหมด: {len(df):,}")
        print(f"  - ข้อมูลปกติ: {len(df[df['is_anomaly'] == 0]):,} ({len(df[df['is_anomaly'] == 0])/len(df)*100:.1f}%)")
        print(f"  - ข้อมูลผิดปกติ: {len(df[df['is_anomaly'] == 1]):,} ({len(df[df['is_anomaly'] == 1])/len(df)*100:.1f}%)")
        
        # สถิติรายละเอียดตามประเภท
        if 'anomaly_type' in df.columns:
            print("\nประเภทความผิดปกติ:")
            anomaly_counts = df[df['is_anomaly'] == 1]['anomaly_type'].value_counts()
            for anomaly_type, count in anomaly_counts.head(10).items():
                print(f"  - {anomaly_type}: {count:,} รายการ ({count/len(anomaly_counts)*100:.1f}%)")
        
        # สถิติคุณภาพข้อมูล
        print(f"\nคุณภาพข้อมูล:")
        missing_count = df.isnull().sum().sum()
        print(f"  - ข้อมูลหายไป: {missing_count} รายการ")
        if missing_count == 0:
            print("  - คุณภาพ: ดีเยียม (ไม่มีข้อมูลหายไป)")
        
        # ช่วงค่าที่สมจริง
        print("  - ช่วงค่าข้อมูล:")
        numeric_cols = ['temperature', 'humidity', 'voltage', 'battery_level', 'vpd', 'co2']
        for col in numeric_cols:
            if col in df.columns:
                valid_data = df[df[col] > -900][col]  # กรองค่า error ออก
                if len(valid_data) > 0:
                    q1, q99 = valid_data.quantile([0.01, 0.99])
                    print(f"    - {col}: {q1:.2f} ถึง {q99:.2f} (1%-99% percentile)")
        
        return filepath

# การทดสอบ
if __name__ == "__main__":
    print("ทดสอบการสร้างข้อมูลคุณภาพสูง v2.1")
    print("="*60)
    
    generator = SensorDataGenerator()
    
    # ทดสอบการสร้างข้อมูลปกติ
    print("\n1. ทดสอบข้อมูลปกติ:")
    normal_sample = generator.generate_normal_data_enhanced()
    print(f"Temperature: {normal_sample['temperature']:.1f}°C")
    print(f"Humidity: {normal_sample['humidity']:.1f}%")
    print(f"VPD: {normal_sample['vpd']:.2f} kPa")
    print(f"Dew Point: {normal_sample['dew_point']:.1f}°C")
    
    # ทดสอบการสร้างข้อมูลผิดปกติ
    print("\n2. ทดสอบข้อมูลผิดปกติ:")
    anomaly_samples = generator.generate_sophisticated_anomalies(5)
    for sample in anomaly_samples:
        print(f"  {sample['anomaly_type']}: T={sample['temperature']:.1f}°C, H={sample['humidity']:.1f}%")
    
    # ทดสอบการสร้างชุดข้อมูลขนาดเล็ก
    print("\n3. ทดสอบชุดข้อมูลขนาดเล็ก:")
    small_df = generator.generate_comprehensive_dataset_enhanced(days=7, normal_ratio=0.80)
    
    # บันทึกข้อมูลทดสอบ
    filepath = generator.save_dataset(small_df, "test_sensor_data_v21.csv")
    
    print(f"\nตัวอย่างข้อมูล 5 รายการแรก:")
    print(small_df[['temperature', 'humidity', 'vpd', 'voltage', 'is_anomaly', 'anomaly_type']].head())
    
    print(f"\nข้อมูลทดสอบถูกบันทึกที่: {filepath}")
    print("การทดสอบเสร็จสิ้น!")