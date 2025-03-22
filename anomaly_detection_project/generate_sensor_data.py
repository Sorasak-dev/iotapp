#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
โปรแกรมสร้างไฟล์ JSON สำหรับทดสอบระบบตรวจจับความผิดปกติ (Anomaly Detection)
รันคำสั่งนี้เพื่อสร้างไฟล์: python generate_sensor_data.py
"""

import random
import json
import datetime
import os
import argparse
import numpy as np
from typing import List, Dict, Any, Optional, Tuple, Union

class AnomalyGenerator:
    """
    คลาสสำหรับสร้างข้อมูลเซนเซอร์พร้อมความผิดปกติประเภทต่างๆ
    """
    
    def __init__(
        self, 
        start_date: datetime.datetime = datetime.datetime(2024, 1, 1),
        num_days: int = 30,
        readings_per_hour: int = 6,  # อ่านค่าทุกๆ 10 นาที (6 ครั้ง/ชั่วโมง)
        sensor_id: str = "GH001",
        location: str = "โรงเรือนเพาะเห็ด 1"
    ):
        """
        กำหนดค่าเริ่มต้นสำหรับการสร้างข้อมูล
        
        Args:
            start_date: วันที่เริ่มบันทึกข้อมูล
            num_days: จำนวนวันที่ต้องการสร้างข้อมูล
            readings_per_hour: จำนวนการอ่านค่าต่อชั่วโมง
            sensor_id: รหัสเซนเซอร์
            location: ตำแหน่งของเซนเซอร์
        """
        self.start_date = start_date
        self.num_days = num_days
        self.readings_per_hour = readings_per_hour
        self.minutes_per_reading = 60 // readings_per_hour
        self.sensor_id = sensor_id
        self.location = location
        
        # กำหนดค่าปกติสำหรับแต่ละพารามิเตอร์
        self.normal_values = {
            "temperature": 28.0,  # °C
            "humidity": 85.0,     # %
            "vpd": 1.2,          # kPa
            "dew_point": 25.0,    # °C
            "EC": 1.5,           # mS/cm
            "pH": 6.5,           # pH
            "CO2": 800.0,        # ppm
            "battery_level": 100.0, # %
            "voltage": 3.3        # V
        }
        
        # กำหนดความผันผวนปกติสำหรับแต่ละพารามิเตอร์ (แบบเกาส์เซียน)
        self.normal_fluctuations = {
            "temperature": 1.0,   # ±1.0°C
            "humidity": 3.0,      # ±3.0%
            "vpd": 0.2,          # ±0.2 kPa
            "dew_point": 0.8,     # ±0.8°C
            "EC": 0.1,           # ±0.1 mS/cm
            "pH": 0.2,           # ±0.2 pH
            "CO2": 50.0,         # ±50.0 ppm
            "battery_level": 0.1, # ±0.1%
            "voltage": 0.05       # ±0.05V
        }
        
        # ค่าการทำงานปกติของแบตเตอรี่ (ลดลงวันละ 5%)
        self.battery_drain_rate = 5.0 / (24 * self.readings_per_hour)  # % ต่อการอ่านค่า
        
        # กำหนดรายการความผิดปกติที่จะสร้าง
        self.anomalies = []
        
        # เก็บข้อมูลทั้งหมด
        self.data = []
    
    def add_unexpected_drop_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int, 
        params: List[str],
        drop_percent: float = 50.0
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่าลดลงกะทันหัน (Unexpected Drop)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            params: รายการพารามิเตอร์ที่ได้รับผลกระทบ
            drop_percent: เปอร์เซ็นต์ที่ค่าลดลง
        """
        self.anomalies.append({
            "type": "unexpected_drop",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "params": params,
            "drop_percent": drop_percent,
            "description": "ค่าจากเซนเซอร์ลดลงกะทันหัน (Unexpected Drop)"
        })
    
    def add_unexpected_spike_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int, 
        params: List[str],
        spike_percent: float = 50.0
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่าพุ่งสูงผิดปกติ (Unexpected Spike)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            params: รายการพารามิเตอร์ที่ได้รับผลกระทบ
            spike_percent: เปอร์เซ็นต์ที่ค่าเพิ่มขึ้น
        """
        self.anomalies.append({
            "type": "unexpected_spike",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "params": params,
            "spike_percent": spike_percent,
            "description": "ค่าจากเซนเซอร์พุ่งสูงผิดปกติ (Unexpected Spike)"
        })
    
    def add_constant_value_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int, 
        params: List[str]
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่าคงที่ไม่เปลี่ยนแปลง (Constant Value)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            params: รายการพารามิเตอร์ที่ได้รับผลกระทบ
        """
        self.anomalies.append({
            "type": "constant_value",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "params": params,
            "description": "เซนเซอร์ส่งค่าซ้ำๆ ไม่เปลี่ยนแปลง (Constant Value Anomaly)"
        })
    
    def add_missing_data_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int
    ) -> None:
        """
        เพิ่มความผิดปกติแบบข้อมูลหายไป (Missing Data)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
        """
        self.anomalies.append({
            "type": "missing_data",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "description": "เซนเซอร์หยุดส่งค่า (Missing Data)"
        })
    
    def add_power_supply_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int,
        min_voltage: float = 2.8,
        max_voltage: float = 3.3
    ) -> None:
        """
        เพิ่มความผิดปกติของการจ่ายพลังงาน (Power Supply Anomalies)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            min_voltage: แรงดันไฟต่ำสุด
            max_voltage: แรงดันไฟสูงสุด
        """
        self.anomalies.append({
            "type": "power_supply",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "min_voltage": min_voltage,
            "max_voltage": max_voltage,
            "description": "ความผิดปกติของการจ่ายพลังงาน (Power Supply Anomalies)"
        })
    
    def add_high_fluctuation_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int, 
        params: List[str],
        multiplier: float = 5.0
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่าผันผวนมากผิดปกติ (High Fluctuation)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            params: รายการพารามิเตอร์ที่ได้รับผลกระทบ
            multiplier: ตัวคูณความผันผวนปกติ
        """
        self.anomalies.append({
            "type": "high_fluctuation",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "params": params,
            "multiplier": multiplier,
            "description": "ค่าผันผวนมากผิดปกติ (High Fluctuation)"
        })
    
    def add_hardware_failure_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int, 
        params: List[str],
        value: float = 0.0
    ) -> None:
        """
        เพิ่มความผิดปกติแบบอุปกรณ์เสีย (Hardware Failure)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            params: รายการพารามิเตอร์ที่ได้รับผลกระทบ
            value: ค่าคงที่ที่ส่ง (ปกติเป็น 0 หรือ -999)
        """
        self.anomalies.append({
            "type": "hardware_failure",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "params": params,
            "value": value,
            "description": "อุปกรณ์เสีย (Hardware Failure)"
        })
    
    def add_battery_depleted_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int
    ) -> None:
        """
        เพิ่มความผิดปกติแบบแบตหมด (Battery Depleted)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
        """
        self.anomalies.append({
            "type": "battery_depleted",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "description": "แบตหมด (Battery Depleted)"
        })
    
    def add_delayed_data_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int,
        delay_seconds: int = 45
    ) -> None:
        """
        เพิ่มความผิดปกติแบบข้อมูลล่าช้า (Delayed Data)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            delay_seconds: จำนวนวินาทีที่ล่าช้า
        """
        self.anomalies.append({
            "type": "delayed_data",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "delay_seconds": delay_seconds,
            "description": "ค่ามีความหน่วงเวลามากเกินไป (Delayed Data)"
        })
    
    def add_network_lost_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int
    ) -> None:
        """
        เพิ่มความผิดปกติแบบขาดการเชื่อมต่อ (Network Lost)
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
        """
        self.anomalies.append({
            "type": "network_lost",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "description": "ขาดการเชื่อมต่อ (Network Lost)"
        })
    
    def add_high_vpd_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int,
        vpd_value: float = 0.3
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่า VPD ต่ำเกินไป
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            vpd_value: ค่า VPD ที่ต่ำเกินไป
        """
        self.anomalies.append({
            "type": "low_vpd",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "vpd_value": vpd_value,
            "description": "ค่า VPD ต่ำกว่า 0.5 kPa"
        })
    
    def add_dew_point_anomaly(
        self, 
        day: int, 
        hour_start: int, 
        hour_end: int,
        temp_diff: float = 1.5
    ) -> None:
        """
        เพิ่มความผิดปกติแบบค่า Dew Point เข้าใกล้ค่าอุณหภูมิจริงมากเกินไป
        
        Args:
            day: วันที่เกิดความผิดปกติ
            hour_start: ชั่วโมงเริ่มต้น
            hour_end: ชั่วโมงสิ้นสุด
            temp_diff: ความแตกต่างระหว่าง Dew Point กับอุณหภูมิจริง
        """
        self.anomalies.append({
            "type": "close_dew_point",
            "day": day,
            "hour_start": hour_start,
            "hour_end": hour_end,
            "temp_diff": temp_diff,
            "description": "ค่า Dew Point เข้าใกล้ค่าอุณหภูมิจริงมากเกินไป"
        })
    
    def add_natural_patterns(self) -> None:
        """
        เพิ่มรูปแบบธรรมชาติในข้อมูล เช่น การเปลี่ยนแปลงตามเวลากลางวัน/กลางคืน และตามฤดูกาล
        """
        # รูปแบบอุณหภูมิตามเวลาของวัน (สูงในตอนกลางวัน ต่ำในตอนกลางคืน)
        self.daily_patterns = {
            "temperature": {h: 2.0 * np.sin(np.pi * h / 12) for h in range(24)},
            "humidity": {h: -8.0 * np.sin(np.pi * h / 12) for h in range(24)},
            "CO2": {h: -50.0 * np.sin(np.pi * h / 12) for h in range(24)}
        }
        
        # รูปแบบอุณหภูมิตามฤดูกาล (สำหรับประเทศไทย)
        # อ้างอิงรูปแบบตามฤดูกาลในประเทศไทย (ร้อน, ฝน, หนาว)
        # ฤดูร้อน: ประมาณเดือน มี.ค. - มิ.ย. (วันที่ ~60-180)
        # ฤดูฝน: ประมาณเดือน ก.ค. - ต.ค. (วันที่ ~180-300)
        # ฤดูหนาว: ประมาณเดือน พ.ย. - ก.พ. (วันที่ ~300-365 และ 0-60)
        self.seasonal_patterns = {
            # อุณหภูมิสูงในฤดูร้อน, ปานกลางในฤดูฝน, ต่ำในฤดูหนาว
            "temperature": lambda day: 2.0 * np.sin(2 * np.pi * (day - 120) / 365),
            # ความชื้นต่ำในฤดูร้อน, สูงในฤดูฝน, ปานกลางในฤดูหนาว
            "humidity": lambda day: 10.0 * np.sin(2 * np.pi * (day - 30) / 365),
            # CO2 มีการเปลี่ยนแปลงเล็กน้อยตามฤดูกาล
            "CO2": lambda day: 30.0 * np.sin(2 * np.pi * day / 365)
        }
    
    def _is_anomaly_active(self, day: int, hour: int, minute: int) -> List[Dict]:
        """
        ตรวจสอบว่าเวลาปัจจุบันอยู่ในช่วงที่มีความผิดปกติหรือไม่
        
        Args:
            day: วันปัจจุบัน
            hour: ชั่วโมงปัจจุบัน
            minute: นาทีปัจจุบัน
            
        Returns:
            list: รายการความผิดปกติที่อยู่ในช่วงเวลาปัจจุบัน
        """
        active_anomalies = []
        exact_time = hour + (minute / 60)
        
        for anomaly in self.anomalies:
            if (anomaly["day"] == day and 
                anomaly["hour_start"] <= exact_time < anomaly["hour_end"]):
                active_anomalies.append(anomaly)
        
        return active_anomalies
    
    def _calculate_dew_point(self, temperature: float, humidity: float) -> float:
        """
        คำนวณ Dew Point จากอุณหภูมิและความชื้น
        
        Args:
            temperature: อุณหภูมิในหน่วย °C
            humidity: ความชื้นสัมพัทธ์ในหน่วย %
            
        Returns:
            float: ค่า Dew Point ในหน่วย °C
        """
        # คำนวณด้วยสูตร Magnus-Tetens
        a = 17.27
        b = 237.7
        
        alpha = ((a * temperature) / (b + temperature)) + np.log(humidity / 100.0)
        dew_point = (b * alpha) / (a - alpha)
        
        return round(dew_point, 2)
    
    def _calculate_vpd(self, temperature: float, humidity: float) -> float:
        """
        คำนวณ Vapor Pressure Deficit (VPD) จากอุณหภูมิและความชื้น
        
        Args:
            temperature: อุณหภูมิในหน่วย °C
            humidity: ความชื้นสัมพัทธ์ในหน่วย %
            
        Returns:
            float: ค่า VPD ในหน่วย kPa
        """
        # คำนวณความดันไอน้ำอิ่มตัว (SVP)
        svp = 0.61078 * np.exp((17.27 * temperature) / (temperature + 237.3))
        
        # คำนวณความดันไอน้ำจริง (AVP)
        avp = svp * (humidity / 100.0)
        
        # คำนวณ VPD
        vpd = svp - avp
        
        return round(vpd, 2)
    
    def _apply_anomalies(
        self, 
        reading: Dict[str, Any], 
        active_anomalies: List[Dict],
        frozen_values: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        ปรับค่าในการอ่านให้เป็นไปตามความผิดปกติที่กำหนด
        
        Args:
            reading: ค่าการอ่านปัจจุบัน
            active_anomalies: รายการความผิดปกติที่กำลังเกิดขึ้น
            frozen_values: ค่าคงที่สำหรับ Constant Value Anomaly
            
        Returns:
            tuple: ค่าการอ่านที่ปรับแล้ว และค่าคงที่ที่อัปเดต
        """
        for anomaly in active_anomalies:
            anomaly_type = anomaly["type"]
            
            # กรณีข้อมูลหายไป
            if anomaly_type == "missing_data" or anomaly_type == "network_lost":
                return None, frozen_values
            
            # กรณีค่าลดลงกะทันหัน
            if anomaly_type == "unexpected_drop":
                for param in anomaly["params"]:
                    if param in reading:
                        reading[param] *= (1 - (anomaly["drop_percent"] / 100))
            
            # กรณีค่าพุ่งสูงผิดปกติ
            elif anomaly_type == "unexpected_spike":
                for param in anomaly["params"]:
                    if param in reading:
                        reading[param] *= (1 + (anomaly["spike_percent"] / 100))
            
            # กรณีค่าคงที่ไม่เปลี่ยนแปลง
            elif anomaly_type == "constant_value":
                for param in anomaly["params"]:
                    if param in reading:
                        if param not in frozen_values:
                            frozen_values[param] = reading[param]
                        reading[param] = frozen_values[param]
            
            # กรณีการจ่ายพลังงานผิดปกติ
            elif anomaly_type == "power_supply":
                reading["voltage"] = random.uniform(
                    anomaly["min_voltage"], 
                    anomaly["max_voltage"]
                )
            
            # กรณีค่าผันผวนมากผิดปกติ
            elif anomaly_type == "high_fluctuation":
                for param in anomaly["params"]:
                    if param in reading and param in self.normal_fluctuations:
                        fluctuation = self.normal_fluctuations[param] * anomaly["multiplier"]
                        reading[param] += random.uniform(-fluctuation, fluctuation)
            
            # กรณีอุปกรณ์เสีย
            elif anomaly_type == "hardware_failure":
                for param in anomaly["params"]:
                    if param in reading:
                        reading[param] = anomaly["value"]
            
            # กรณีแบตหมด
            elif anomaly_type == "battery_depleted":
                reading["battery_level"] = max(0, reading["battery_level"] - 10)
                if reading["battery_level"] < 10:
                    reading["voltage"] = max(0, reading["voltage"] - 0.2)
            
            # กรณีความล่าช้าของข้อมูล
            elif anomaly_type == "delayed_data":
                reading["data_delay"] = anomaly["delay_seconds"]
            
            # กรณี VPD ต่ำเกินไป
            elif anomaly_type == "low_vpd":
                reading["vpd"] = anomaly["vpd_value"]
                # ปรับความชื้นให้สอดคล้องกับ VPD ต่ำ
                reading["humidity"] = min(99, reading["humidity"] + 15)
            
            # กรณี Dew Point ใกล้อุณหภูมิจริง
            elif anomaly_type == "close_dew_point":
                # ปรับ Dew Point ให้ใกล้อุณหภูมิมากขึ้น
                reading["dew_point"] = reading["temperature"] - anomaly["temp_diff"]
                # ปรับความชื้นให้สอดคล้อง
                reading["humidity"] = min(99, reading["humidity"] + 10)
        
        return reading, frozen_values
    
    def generate_data(self) -> None:
        """
        สร้างชุดข้อมูลทั้งหมดตามการกำหนดค่า
        """
        # เริ่มสร้างข้อมูล
        frozen_values = {}
        current_date = self.start_date
        
        # เพิ่มรูปแบบการเปลี่ยนแปลงตามธรรมชาติ
        self.add_natural_patterns()
        
        # สำหรับแต่ละวัน
        for day in range(self.num_days):
            # สำหรับแต่ละชั่วโมง
            for hour in range(24):
                # สำหรับแต่ละการอ่านค่าในชั่วโมงนี้
                for reading_index in range(self.readings_per_hour):
                    minute = reading_index * self.minutes_per_reading
                    
                    # เวลาปัจจุบัน
                    current_time = current_date + datetime.timedelta(
                        hours=hour, 
                        minutes=minute
                    )
                    timestamp = current_time.strftime("%Y-%m-%d %H:%M:%S")
                    
                    # ปรับค่าตามเวลาของวัน (กลางวัน/กลางคืน)
                    temp_adjustment = self.daily_patterns["temperature"][hour]
                    humidity_adjustment = self.daily_patterns["humidity"][hour]
                    co2_adjustment = self.daily_patterns["CO2"][hour]
                    
                    # ปรับค่าตามฤดูกาล
                    temp_seasonal = self.seasonal_patterns["temperature"](day)
                    humidity_seasonal = self.seasonal_patterns["humidity"](day)
                    co2_seasonal = self.seasonal_patterns["CO2"](day)
                    
                    # สร้างค่าการอ่านพื้นฐาน (รวมการเปลี่ยนแปลงตามวัน+ฤดูกาล)
                    temperature = self.normal_values["temperature"] + temp_adjustment + temp_seasonal
                    humidity = self.normal_values["humidity"] + humidity_adjustment + humidity_seasonal
                    
                    # เพิ่มความผันผวนธรรมชาติ (เกาส์เซียน)
                    temperature += random.normalvariate(0, self.normal_fluctuations["temperature"])
                    humidity += random.normalvariate(0, self.normal_fluctuations["humidity"])
                    
                    # ลดแบตเตอรี่ลงตามเวลาที่ผ่านไป
                    battery_level = max(0, self.normal_values["battery_level"] - (day * 24 + hour) * self.battery_drain_rate)
                    
                    # คำนวณค่าอื่นๆ
                    dew_point = self._calculate_dew_point(temperature, humidity)
                    vpd = self._calculate_vpd(temperature, humidity)
                    
                    # สร้างค่าอื่นๆ พร้อมความผันผวนแบบเกาส์เซียน
                    ec = self.normal_values["EC"] + random.normalvariate(0, self.normal_fluctuations["EC"])
                    ph = self.normal_values["pH"] + random.normalvariate(0, self.normal_fluctuations["pH"])
                    co2 = self.normal_values["CO2"] + co2_adjustment + co2_seasonal + random.normalvariate(0, self.normal_fluctuations["CO2"])
                    voltage = self.normal_values["voltage"] + random.normalvariate(0, self.normal_fluctuations["voltage"])
                    
                    # สร้างข้อมูลรายชั่วโมง
                    reading = {
                        "timestamp": timestamp,
                        "sensor_id": self.sensor_id,
                        "location": self.location,
                        "temperature": round(temperature, 1),
                        "humidity": round(humidity, 1),
                        "vpd": round(vpd, 2),
                        "dew_point": round(dew_point, 2),
                        "EC": round(ec, 2),
                        "pH": round(ph, 2),
                        "CO2": round(co2, 1),
                        "battery_level": round(battery_level, 1),
                        "voltage": round(voltage, 2),
                        "data_delay": 0,  # เวลาหน่วงข้อมูลปกติ = 0 วินาที
                        "is_anomaly": False,
                        "anomaly_type": None,
                        "anomaly_description": None
                    }
                    
                    # ตรวจสอบความผิดปกติที่กำลังเกิดขึ้น
                    active_anomalies = self._is_anomaly_active(day, hour, minute)
                    
                    # มีความผิดปกติเกิดขึ้น
                    if active_anomalies:
                        # ปรับค่าการอ่านตามความผิดปกติ
                        adjusted_reading, frozen_values = self._apply_anomalies(
                            reading, 
                            active_anomalies, 
                            frozen_values
                        )
                        
                        # ถ้าข้อมูลหายไป (None) ไม่ต้องเพิ่มในรายการ
                        if adjusted_reading is None:
                            continue
                        
                        # เพิ่มข้อมูลความผิดปกติ
                        reading = adjusted_reading
                        reading["is_anomaly"] = True
                        reading["anomaly_type"] = active_anomalies[0]["type"]  # ใช้ประเภทแรกในกรณีมีหลายประเภท
                        reading["anomaly_description"] = active_anomalies[0]["description"]
                    
                    # ตรวจสอบความผิดปกติเพิ่มเติมตามกฎเกณฑ์ที่กำหนด
                    
                    # กรณี VPD ต่ำเกินไป (< 0.5 kPa)
                    if reading["vpd"] < 0.5 and not reading["is_anomaly"]:
                        reading["is_anomaly"] = True
                        reading["anomaly_type"] = "low_vpd"
                        reading["anomaly_description"] = "ค่า VPD ต่ำกว่า 0.5 kPa"
                    
                    # กรณี Dew Point ใกล้อุณหภูมิจริงเกินไป (< 2°C)
                    if (reading["temperature"] - reading["dew_point"] < 2.0) and not reading["is_anomaly"]:
                        reading["is_anomaly"] = True
                        reading["anomaly_type"] = "close_dew_point"
                        reading["anomaly_description"] = "ค่า Dew Point เข้าใกล้ค่าอุณหภูมิจริงมากเกินไป"
                    
                    # เพิ่มข้อมูลลงในรายการ
                    self.data.append(reading)
            
            # ปรับค่าปกติเล็กน้อยทุกวัน เพื่อจำลองการเปลี่ยนแปลงตามธรรมชาติ
            for param in self.normal_values:
                if param != "battery_level":  # ไม่ต้องปรับเพราะมีการคำนวณแยก
                    # ปรับไม่เกิน ±0.5% ของค่าเดิม
                    self.normal_values[param] *= (1 + random.uniform(-0.005, 0.005))
            
            # เพิ่มวันถัดไป
            current_date += datetime.timedelta(days=1)
    
    def add_realistic_anomalies(self) -> None:
        """
        เพิ่มความผิดปกติที่สมจริงตามเอกสารทั้งหมดอัตโนมัติ
        กระจายความผิดปกติตลอดทั้งปี (365 วัน)
        """
        # กระจายความผิดปกติให้ครอบคลุมทั้งปี
        
        # กุมภาพันธ์ (ประมาณวันที่ 32-59)
        # 1. Unexpected Drop (ค่าจากเซนเซอร์ลดลงกะทันหัน)
        self.add_unexpected_drop_anomaly(
            day=35, 
            hour_start=8, 
            hour_end=14, 
            params=["temperature", "humidity"],
            drop_percent=40
        )
        
        # มีนาคม (ประมาณวันที่ 60-90)
        # 2. Unexpected Spike (ค่าจากเซนเซอร์พุ่งสูงผิดปกติ)
        self.add_unexpected_spike_anomaly(
            day=75,
            hour_start=14,
            hour_end=18,
            params=["temperature", "CO2"],
            spike_percent=60
        )
        
        # เมษายน (ประมาณวันที่ 91-120)
        # 3. Constant Value (เซนเซอร์ส่งค่าซ้ำๆ ไม่เปลี่ยนแปลง)
        self.add_constant_value_anomaly(
            day=105,
            hour_start=6,
            hour_end=14,
            params=["temperature", "humidity", "CO2"]
        )
        
        # พฤษภาคม (ประมาณวันที่ 121-151)
        # 4. Missing Data (เซนเซอร์หยุดส่งค่า)
        self.add_missing_data_anomaly(
            day=135,
            hour_start=18,
            hour_end=23.99  # เกือบทั้งวัน
        )
        
        # มิถุนายน (ประมาณวันที่ 152-181)
        # 5. Power Supply Anomalies (ความผิดปกติของการจ่ายพลังงาน)
        self.add_power_supply_anomaly(
            day=165,
            hour_start=10,
            hour_end=20,
            min_voltage=2.8,
            max_voltage=3.3
        )
        
        # กรกฎาคม (ประมาณวันที่ 182-212)
        # 6. High Fluctuation (ค่าผันผวนมากผิดปกติ)
        self.add_high_fluctuation_anomaly(
            day=195,
            hour_start=12,
            hour_end=18,
            params=["temperature", "humidity", "CO2"],
            multiplier=5.0
        )
        
        # สิงหาคม (ประมาณวันที่ 213-243)
        # 7. Hardware Failure (อุปกรณ์เสีย)
        self.add_hardware_failure_anomaly(
            day=225,
            hour_start=0,
            hour_end=10,
            params=["EC", "pH"],
            value=0.0
        )
        
        # กันยายน (ประมาณวันที่ 244-273)
        # 8. Battery Depleted (แบตหมด)
        self.add_battery_depleted_anomaly(
            day=255,
            hour_start=6,
            hour_end=24
        )
        
        # ตุลาคม (ประมาณวันที่ 274-304)
        # 9. Delayed Data (ค่ามีความหน่วงเวลามากเกินไป)
        self.add_delayed_data_anomaly(
            day=285,
            hour_start=8,
            hour_end=16,
            delay_seconds=45
        )
        
        # พฤศจิกายน (ประมาณวันที่ 305-334)
        # 10. Network Lost (ขาดการเชื่อมต่อ)
        self.add_network_lost_anomaly(
            day=320,
            hour_start=14,
            hour_end=18
        )
        
        # ธันวาคม (ประมาณวันที่ 335-365)
        # 11. Low VPD (ค่า VPD ต่ำกว่า 0.5 kPa)
        self.add_high_vpd_anomaly(
            day=345,
            hour_start=10,
            hour_end=14,
            vpd_value=0.3
        )
        
        # ธันวาคม ช่วงปลาย
        # 12. Close Dew Point (Dew Point ใกล้อุณหภูมิจริง)
        self.add_dew_point_anomaly(
            day=358,
            hour_start=4,
            hour_end=8,
            temp_diff=1.5
        )
        
        # เพิ่มความผิดปกติกระจายเพิ่มเติมตลอดทั้งปี
        
        # มกราคม - กุมภาพันธ์
        self.add_unexpected_spike_anomaly(
            day=15,
            hour_start=12,
            hour_end=16,
            params=["temperature"],
            spike_percent=50
        )
        
        # มีนาคม - เมษายน
        self.add_constant_value_anomaly(
            day=80,
            hour_start=22,
            hour_end=23.99,
            params=["humidity", "vpd"]
        )
        
        # พฤษภาคม - มิถุนายน
        self.add_hardware_failure_anomaly(
            day=150,
            hour_start=2,
            hour_end=6,
            params=["CO2"],
            value=-999.0
        )
        
        # กรกฎาคม - สิงหาคม
        self.add_power_supply_anomaly(
            day=200,
            hour_start=16,
            hour_end=23,
            min_voltage=2.5,
            max_voltage=3.0
        )
        
        # กันยายน - ตุลาคม
        self.add_high_fluctuation_anomaly(
            day=270,
            hour_start=8,
            hour_end=14,
            params=["pH", "EC"],
            multiplier=4.0
        )
        
        # พฤศจิกายน - ธันวาคม
        self.add_dew_point_anomaly(
            day=330,
            hour_start=18,
            hour_end=22,
            temp_diff=1.0
        )
    
    def save_data(self, filename: str = "sensor_data.json", folder: str = "data") -> str:
        """
        บันทึกข้อมูลที่สร้างเป็นไฟล์ JSON
        
        Args:
            filename: ชื่อไฟล์ที่ต้องการบันทึก
            folder: โฟลเดอร์ที่ต้องการบันทึก
            
        Returns:
            str: พาธของไฟล์ที่บันทึก
        """
        # สร้างพาธสำหรับบันทึกไฟล์
        if not os.path.exists(folder):
            os.makedirs(folder)
        
        output_path = os.path.join(folder, filename)
        
        # เพิ่มข้อมูล metadata
        metadata = {
            "total_readings": len(self.data),
            "start_date": self.start_date.strftime("%Y-%m-%d"),
            "end_date": (self.start_date + datetime.timedelta(days=self.num_days-1)).strftime("%Y-%m-%d"),
            "sensor_id": self.sensor_id,
            "location": self.location,
            "anomalies": [
                {
                    "type": anomaly["type"],
                    "day": anomaly["day"],
                    "description": anomaly["description"],
                    "date": (self.start_date + datetime.timedelta(days=anomaly["day"])).strftime("%Y-%m-%d")
                }
                for anomaly in self.anomalies
            ]
        }
        
        # สร้าง output ในรูปแบบที่ต้องการ
        output = {
            "metadata": metadata,
            "data": self.data
        }
        
        # บันทึกเป็นไฟล์ JSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=4, ensure_ascii=False)
        
        return output_path
    
    def save_data_csv(self, filename: str = "sensor_data.csv", folder: str = "data") -> str:
        """
        บันทึกข้อมูลที่สร้างเป็นไฟล์ CSV
        
        Args:
            filename: ชื่อไฟล์ที่ต้องการบันทึก
            folder: โฟลเดอร์ที่ต้องการบันทึก
            
        Returns:
            str: พาธของไฟล์ที่บันทึก
        """
        # สร้างพาธสำหรับบันทึกไฟล์
        if not os.path.exists(folder):
            os.makedirs(folder)
        
        output_path = os.path.join(folder, filename)
        
        # สร้างไฟล์ CSV
        with open(output_path, "w", encoding="utf-8") as f:
            # เขียนส่วนหัว
            if self.data:
                headers = list(self.data[0].keys())
                f.write(",".join(headers) + "\n")
                
                # เขียนข้อมูล
                for row in self.data:
                    values = [str(row.get(header, "")) for header in headers]
                    f.write(",".join(values) + "\n")
        
        return output_path
    
    def generate_anomaly_report(self, filename: str = "anomaly_report.txt", folder: str = "data") -> str:
        """
        สร้างรายงานสรุปความผิดปกติที่สร้างขึ้น
        
        Args:
            filename: ชื่อไฟล์ที่ต้องการบันทึก
            folder: โฟลเดอร์ที่ต้องการบันทึก
            
        Returns:
            str: พาธของไฟล์ที่บันทึก
        """
        # สร้างพาธสำหรับบันทึกไฟล์
        if not os.path.exists(folder):
            os.makedirs(folder)
        
        output_path = os.path.join(folder, filename)
        
        # นับจำนวนข้อมูลที่เป็นความผิดปกติแต่ละประเภท
        anomaly_counts = {}
        for reading in self.data:
            if reading.get("is_anomaly"):
                anomaly_type = reading.get("anomaly_type")
                if anomaly_type not in anomaly_counts:
                    anomaly_counts[anomaly_type] = 0
                anomaly_counts[anomaly_type] += 1
        
        # เขียนรายงาน
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("รายงานสรุปการสร้างข้อมูลความผิดปกติ\n")
            f.write("=" * 50 + "\n\n")
            
            f.write(f"วันที่เริ่มต้น: {self.start_date.strftime('%Y-%m-%d')}\n")
            f.write(f"จำนวนวัน: {self.num_days}\n")
            f.write(f"รหัสเซนเซอร์: {self.sensor_id}\n")
            f.write(f"ตำแหน่ง: {self.location}\n")
            f.write(f"จำนวนข้อมูลทั้งหมด: {len(self.data)}\n\n")
            
            f.write("รายละเอียดความผิดปกติ:\n")
            f.write("-" * 50 + "\n")
            for i, anomaly in enumerate(self.anomalies, 1):
                day_date = (self.start_date + datetime.timedelta(days=anomaly["day"])).strftime("%Y-%m-%d")
                f.write(f"{i}. ประเภท: {anomaly['type']}\n")
                f.write(f"   วันที่: {day_date} (วันที่ {anomaly['day'] + 1})\n")
                f.write(f"   เวลา: {anomaly['hour_start']:02.0f}:00 - {anomaly['hour_end']:02.0f}:00\n")
                f.write(f"   รายละเอียด: {anomaly['description']}\n")
                f.write("-" * 50 + "\n")
            
            f.write("\nสรุปจำนวนข้อมูลที่มีความผิดปกติ:\n")
            f.write("-" * 50 + "\n")
            for anomaly_type, count in anomaly_counts.items():
                f.write(f"{anomaly_type}: {count} รายการ\n")
        
        return output_path

def main():
    """
    ฟังก์ชันหลักสำหรับสร้างไฟล์ข้อมูลตัวอย่าง
    """
    # ตั้งค่าการวิเคราะห์ command line arguments
    parser = argparse.ArgumentParser(description="สร้างข้อมูลตัวอย่างสำหรับ anomaly detection")
    parser.add_argument("--days", type=int, default=365, help="จำนวนวันที่ต้องการสร้างข้อมูล")
    parser.add_argument("--readings", type=int, default=1, help="จำนวนการอ่านค่าต่อชั่วโมง (ค่าเริ่มต้น: 1 = ทุกชั่วโมง)")
    parser.add_argument("--sensor-id", type=str, default="GH001", help="รหัสเซนเซอร์")
    parser.add_argument("--location", type=str, default="โรงเรือนเพาะเห็ด 1", help="ตำแหน่งของเซนเซอร์")
    parser.add_argument("--output", type=str, default="anomaly_detection_project", help="โฟลเดอร์ที่ต้องการบันทึกผลลัพธ์")
    parser.add_argument("--format", choices=["json", "csv", "both"], default="json", help="รูปแบบไฟล์ที่ต้องการ (json, csv, หรือ both)")
    args = parser.parse_args()
    
    # สร้างโฟลเดอร์สำหรับเก็บข้อมูล
    if not os.path.exists(args.output):
        os.makedirs(args.output)
        print(f"สร้างโฟลเดอร์ {args.output} เรียบร้อยแล้ว")
    
    # สร้างตัวสร้างข้อมูล
    print(f"เริ่มสร้างข้อมูลเซนเซอร์สำหรับ {args.days} วัน (ข้อมูลทุกชั่วโมง)")
    print(f"จะมีข้อมูลประมาณ {args.days * 24 * args.readings} รายการ")
    print("กำลังเริ่มสร้างข้อมูล... (อาจใช้เวลาสักครู่)")
    
    generator = AnomalyGenerator(
        num_days=args.days,
        readings_per_hour=args.readings,
        sensor_id=args.sensor_id,
        location=args.location
    )
    
    # เพิ่มความผิดปกติแบบสมจริง
    generator.add_realistic_anomalies()
    
    # สร้างข้อมูล
    print(f"กำลังสร้างข้อมูลสำหรับ {args.days} วัน...")
    generator.generate_data()
    
    # บันทึกข้อมูล
    output_files = []
    
    if args.format in ["json", "both"]:
        json_file = generator.save_data(folder=args.output)
        output_files.append(json_file)
    
    if args.format in ["csv", "both"]:
        csv_file = generator.save_data_csv(folder=args.output)
        output_files.append(csv_file)
    
    # สร้างรายงาน
    report_file = generator.generate_anomaly_report(folder=args.output)
    output_files.append(report_file)
    
    # พิมพ์สรุป
    print(f"\nสร้างข้อมูลสำเร็จจำนวน: {len(generator.data)} รายการ")
    print(f"บันทึกไฟล์แล้วที่:")
    for file in output_files:
        print(f"- {file}")
    
    # พิมพ์สรุปจำนวนความผิดปกติ
    anomaly_count = sum(1 for reading in generator.data if reading.get("is_anomaly"))
    print(f"\nจำนวนข้อมูลปกติ: {len(generator.data) - anomaly_count} รายการ")
    print(f"จำนวนข้อมูลที่มีความผิดปกติ: {anomaly_count} รายการ")
    print(f"คิดเป็น: {(anomaly_count / len(generator.data) * 100):.2f}% ของข้อมูลทั้งหมด")
    
    print("\nคุณสามารถใช้ข้อมูลเหล่านี้สำหรับทดสอบระบบตรวจจับความผิดปกติได้")
    print("ดูรายละเอียดเพิ่มเติมได้ในไฟล์รายงาน:", report_file)

if __name__ == "__main__":
    main()