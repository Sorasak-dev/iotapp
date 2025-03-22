import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import os

class SensorDataVisualizer:
    """
    คลาสสำหรับแสดงผลและวิเคราะห์ข้อมูลเซนเซอร์
    ทั้งข้อมูลปกติและข้อมูลที่มีความผิดปกติ
    """
    
    def __init__(self, data_file):
        """
        ตั้งค่าเริ่มต้นและโหลดข้อมูล
        
        Args:
            data_file: ไฟล์ CSV ที่มีข้อมูลเซนเซอร์
        """
        self.df = pd.read_csv(data_file)
        
        # แปลง timestamp เป็น datetime
        self.df['timestamp'] = pd.to_datetime(self.df['timestamp'])
        
        # ตั้งค่าสีสำหรับแสดงผล
        self.colors = {
            'normal': 'blue',
            'anomaly': 'red'
        }
        
        # สร้างโฟลเดอร์สำหรับเก็บกราฟ
        self.graphs_dir = 'results/graphs'
        os.makedirs(self.graphs_dir, exist_ok=True)
        
        self.anomaly_colors = {
            'unexpected_drop': 'red',
            'unexpected_spike': 'orange',
            'constant_value': 'purple',
            'missing_data': 'black',
            'power_supply_anomaly': 'brown',
            'delayed_data': 'gray',
            'high_fluctuation': 'magenta',
            'low_vpd': 'yellow',
            'dew_point_near_temp': 'cyan',
            'hardware_failure': 'darkred',
            'battery_depleted': 'olive',
            'network_lost': 'darkblue',
            'zero_ec_value': 'pink',
            'zero_ph_value': 'lime',
            'temperature_outlier': 'darkgreen',
            'humidity_outlier': 'teal'
        }
    
    def show_data_overview(self):
        """
        แสดงภาพรวมข้อมูลเซนเซอร์
        """
        print("===== ภาพรวมข้อมูลเซนเซอร์ =====")
        print(f"จำนวนข้อมูลทั้งหมด: {len(self.df)} แถว")
        
        # จำนวนข้อมูลปกติ vs ผิดปกติ
        anomaly_counts = self.df['anomaly'].value_counts()
        print("\nการกระจายของข้อมูลปกติ vs ผิดปกติ:")
        for category, count in anomaly_counts.items():
            percentage = count / len(self.df) * 100
            print(f"- {category}: {count} แถว ({percentage:.2f}%)")
        
        # จำนวนข้อมูลในแต่ละประเภทความผิดปกติ
        if 'anomaly_type' in self.df.columns:
            anomaly_types = self.df[self.df['anomaly'] == 'anomaly']['anomaly_type'].value_counts()
            print("\nประเภทของความผิดปกติ:")
            for anomaly_type, count in anomaly_types.items():
                if anomaly_type is not None:  # ข้ามค่า None
                    percentage = count / len(self.df[self.df['anomaly'] == 'anomaly']) * 100
                    print(f"- {anomaly_type}: {count} แถว ({percentage:.2f}%)")
        
        # จำนวนข้อมูลในแต่ละเซนเซอร์
        if 'sensor_id' in self.df.columns:
            sensor_counts = self.df['sensor_id'].value_counts()
            print("\nจำนวนข้อมูลในแต่ละเซนเซอร์:")
            for sensor_id, count in sensor_counts.items():
                percentage = count / len(self.df) * 100
                print(f"- {sensor_id}: {count} แถว ({percentage:.2f}%)")
        
        # ช่วงเวลาของข้อมูล
        min_date = self.df['timestamp'].min()
        max_date = self.df['timestamp'].max()
        print(f"\nช่วงเวลาของข้อมูล: {min_date} ถึง {max_date}")
        
        # สถิติพื้นฐานของคอลัมน์ตัวเลข
        numeric_cols = self.df.select_dtypes(include=['float64', 'int64']).columns
        numeric_cols = [col for col in numeric_cols if col not in ['anomaly']]
        print("\nสถิติพื้นฐานของข้อมูลตัวเลข:")
        print(self.df[numeric_cols].describe())
        
        # บันทึกกราฟการกระจายความผิดปกติ
        plt.figure(figsize=(10, 6))
        anomaly_types_for_plot = self.df[self.df['anomaly'] == 'anomaly']['anomaly_type'].value_counts()
        anomaly_types_for_plot.plot(kind='bar', color='red')
        plt.title('จำนวนความผิดปกติแต่ละประเภท')
        plt.xlabel('ประเภทความผิดปกติ')
        plt.ylabel('จำนวน')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(f'{self.graphs_dir}/anomaly_types_distribution.png')
        plt.close()
    
    def plot_time_series(self, sensor_id=None, feature='temperature', start_date=None, end_date=None, figsize=(12, 6), save_fig=True):
        """
        แสดงกราฟข้อมูลตามเวลาพร้อมระบุความผิดปกติ
        
        Args:
            sensor_id: รหัสของเซนเซอร์ที่ต้องการแสดงผล (ถ้าไม่ระบุจะใช้ทุกเซนเซอร์)
            feature: คุณลักษณะที่ต้องการแสดงผล (เช่น 'temperature', 'humidity', 'vpd')
            start_date: วันที่เริ่มต้น (optional)
            end_date: วันที่สิ้นสุด (optional)
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # กรองข้อมูลตามเซนเซอร์
        if sensor_id is not None and 'sensor_id' in self.df.columns:
            df_sensor = self.df[self.df['sensor_id'] == sensor_id].copy()
        else:
            df_sensor = self.df.copy()
            sensor_id = 'all'
        
        # กรองตามช่วงเวลา (ถ้าระบุ)
        if start_date:
            df_sensor = df_sensor[df_sensor['timestamp'] >= start_date]
        if end_date:
            df_sensor = df_sensor[df_sensor['timestamp'] <= end_date]
        
        # ตรวจสอบว่ามีข้อมูลหรือไม่
        if len(df_sensor) == 0:
            print(f"ไม่พบข้อมูลสำหรับเซนเซอร์ {sensor_id} ในช่วงเวลาที่ระบุ")
            return
        
        # ตรวจสอบว่ามีคุณลักษณะที่ต้องการหรือไม่
        if feature not in df_sensor.columns:
            print(f"ไม่พบคุณลักษณะ {feature} ในข้อมูล")
            return
        
        # สร้างกราฟ
        plt.figure(figsize=figsize)
        
        # แยกข้อมูลปกติและผิดปกติ
        df_normal = df_sensor[df_sensor['anomaly'] == 'normal']
        df_anomaly = df_sensor[df_sensor['anomaly'] == 'anomaly']
        
        # วาดข้อมูลปกติ
        plt.plot(df_normal['timestamp'], df_normal[feature], 
                 color=self.colors['normal'], label='Normal', alpha=0.7)
        
        # วาดข้อมูลผิดปกติ
        plt.scatter(df_anomaly['timestamp'], df_anomaly[feature], 
                   color=self.colors['anomaly'], label='Anomaly', s=50, zorder=5)
        
        # ตั้งค่ากราฟ
        plt.title(f'ข้อมูล {feature} จากเซนเซอร์ {sensor_id}', fontsize=15)
        plt.xlabel('เวลา')
        plt.ylabel(f'{feature}')
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.legend()
        
        # แสดงกราฟ
        plt.tight_layout()
        
        # บันทึกกราฟ
        if save_fig:
            plt.savefig(f'{self.graphs_dir}/{feature}_timeseries_{sensor_id}.png')
        
        plt.close()
    
    def plot_anomaly_types(self, sensor_id=None, feature='temperature', start_date=None, end_date=None, figsize=(15, 8), save_fig=True):
        """
        แสดงกราฟข้อมูลตามเวลาแยกตามประเภทความผิดปกติ
        
        Args:
            sensor_id: รหัสของเซนเซอร์ที่ต้องการแสดงผล (ถ้าไม่ระบุจะใช้ทุกเซนเซอร์)
            feature: คุณลักษณะที่ต้องการแสดงผล (เช่น 'temperature', 'humidity', 'vpd')
            start_date: วันที่เริ่มต้น (optional)
            end_date: วันที่สิ้นสุด (optional)
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # กรองข้อมูลตามเซนเซอร์
        if sensor_id is not None and 'sensor_id' in self.df.columns:
            df_sensor = self.df[self.df['sensor_id'] == sensor_id].copy()
        else:
            df_sensor = self.df.copy()
            sensor_id = 'all'
        
        # กรองตามช่วงเวลา (ถ้าระบุ)
        if start_date:
            df_sensor = df_sensor[df_sensor['timestamp'] >= start_date]
        if end_date:
            df_sensor = df_sensor[df_sensor['timestamp'] <= end_date]
        
        # ตรวจสอบว่ามีข้อมูลหรือไม่
        if len(df_sensor) == 0:
            print(f"ไม่พบข้อมูลสำหรับเซนเซอร์ {sensor_id} ในช่วงเวลาที่ระบุ")
            return
        
        # ตรวจสอบว่ามีคุณลักษณะที่ต้องการหรือไม่
        if feature not in df_sensor.columns:
            print(f"ไม่พบคุณลักษณะ {feature} ในข้อมูล")
            return
        
        # สร้างกราฟ
        plt.figure(figsize=figsize)
        
        # แยกข้อมูลปกติและผิดปกติ
        df_normal = df_sensor[df_sensor['anomaly'] == 'normal']
        
       # วาดข้อมูลปกติ
        plt.plot(df_normal['timestamp'], df_normal[feature], 
                 color=self.colors['normal'], label='Normal', alpha=0.5)
        
        # วาดข้อมูลผิดปกติแยกตามประเภท
        if 'anomaly_type' in df_sensor.columns:
            anomaly_types = df_sensor[df_sensor['anomaly'] == 'anomaly']['anomaly_type'].unique()
            
            for anomaly_type in anomaly_types:
                if anomaly_type is not None:  # ข้ามค่า None
                    df_type = df_sensor[(df_sensor['anomaly'] == 'anomaly') & 
                                       (df_sensor['anomaly_type'] == anomaly_type)]
                    
                    color = self.anomaly_colors.get(anomaly_type, 'black')
                    plt.scatter(df_type['timestamp'], df_type[feature], 
                               color=color, label=anomaly_type, s=50, alpha=0.8)
        
        # ตั้งค่ากราฟ
        plt.title(f'ข้อมูล {feature} จากเซนเซอร์ {sensor_id} แยกตามประเภทความผิดปกติ', fontsize=15)
        plt.xlabel('เวลา')
        plt.ylabel(f'{feature}')
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.legend(loc='best', bbox_to_anchor=(1.05, 1), borderaxespad=0.)
        
        # แสดงกราฟ
        plt.tight_layout()
        
        # บันทึกกราฟ
        if save_fig:
            plt.savefig(f'{self.graphs_dir}/{feature}_anomaly_types_{sensor_id}.png')
        
        plt.close()
    
    def plot_feature_distribution(self, feature='temperature', by_anomaly=True, figsize=(12, 6), save_fig=True):
        """
        แสดงการกระจายของคุณลักษณะต่างๆ แยกตามข้อมูลปกติและผิดปกติ
        
        Args:
            feature: คุณลักษณะที่ต้องการแสดงผล (เช่น 'temperature', 'humidity', 'vpd')
            by_anomaly: แยกตามข้อมูลปกติ/ผิดปกติหรือไม่
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # ตรวจสอบว่ามีคุณลักษณะที่ต้องการหรือไม่
        if feature not in self.df.columns:
            print(f"ไม่พบคุณลักษณะ {feature} ในข้อมูล")
            return
        
        plt.figure(figsize=figsize)
        
        if by_anomaly:
            # แยกตามข้อมูลปกติและผิดปกติ
            sns.histplot(data=self.df, x=feature, hue='anomaly', 
                         bins=30, kde=True, palette=self.colors)
            plt.title(f'การกระจายของ {feature} แยกตามข้อมูลปกติและผิดปกติ', fontsize=15)
        else:
            # ไม่แยกตามข้อมูลปกติและผิดปกติ
            sns.histplot(data=self.df, x=feature, bins=30, kde=True)
            plt.title(f'การกระจายของ {feature}', fontsize=15)
        
        plt.xlabel(feature)
        plt.ylabel('ความถี่')
        plt.grid(True, linestyle='--', alpha=0.7)
        
        # บันทึกกราฟ
        if save_fig:
            plt.savefig(f'{self.graphs_dir}/{feature}_distribution.png')
        
        plt.close()
    
    def plot_correlation_matrix(self, figsize=(10, 8), save_fig=True):
        """
        แสดงเมทริกซ์สหสัมพันธ์ (correlation matrix) ของคุณลักษณะต่างๆ
        
        Args:
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # เลือกเฉพาะคอลัมน์ตัวเลข
        numeric_cols = self.df.select_dtypes(include=['float64', 'int64']).columns
        
        # คัดกรองเฉพาะคอลัมน์ที่ต้องการ (ไม่รวม anomaly)
        feature_cols = [col for col in numeric_cols if col not in ['anomaly']]
        
        # ตรวจสอบว่ามีคอลัมน์ตัวเลขเพียงพอหรือไม่
        if len(feature_cols) < 2:
            print("ไม่มีคอลัมน์ตัวเลขเพียงพอสำหรับการแสดงเมทริกซ์สหสัมพันธ์")
            return
        
        # คำนวณเมทริกซ์สหสัมพันธ์
        corr_matrix = self.df[feature_cols].corr()
        
        # สร้างกราฟ
        plt.figure(figsize=figsize)
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f', linewidths=0.5)
        plt.title('เมทริกซ์สหสัมพันธ์ของคุณลักษณะต่างๆ', fontsize=15)
        
        # บันทึกกราฟ
        if save_fig:
            plt.savefig(f'{self.graphs_dir}/correlation_matrix.png')
        
        plt.close()
    
    def plot_anomaly_count_by_time(self, time_unit='day', figsize=(12, 6), save_fig=True):
        """
        แสดงจำนวนความผิดปกติตามช่วงเวลา
        
        Args:
            time_unit: หน่วยเวลาที่ต้องการแสดงผล ('hour', 'day', 'week', 'month')
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # สร้าง timestamp ใหม่ตามหน่วยเวลา
        df_anomaly = self.df[self.df['anomaly'] == 'anomaly'].copy()
        
        if time_unit == 'hour':
            df_anomaly['time_group'] = df_anomaly['timestamp'].dt.floor('H')
            xlabel = 'ชั่วโมง'
        elif time_unit == 'day':
            df_anomaly['time_group'] = df_anomaly['timestamp'].dt.floor('D')
            xlabel = 'วัน'
        elif time_unit == 'week':
            df_anomaly['time_group'] = df_anomaly['timestamp'].dt.to_period('W').dt.start_time
            xlabel = 'สัปดาห์'
        elif time_unit == 'month':
            df_anomaly['time_group'] = df_anomaly['timestamp'].dt.to_period('M').dt.start_time
            xlabel = 'เดือน'
        else:
            raise ValueError("time_unit ต้องเป็น 'hour', 'day', 'week', หรือ 'month'")
        
        # นับจำนวนความผิดปกติในแต่ละช่วงเวลา
        anomaly_counts = df_anomaly.groupby('time_group').size().reset_index(name='count')
        
        # สร้างกราฟ
        plt.figure(figsize=figsize)
        plt.bar(anomaly_counts['time_group'], anomaly_counts['count'], color='red', alpha=0.7)
        plt.title(f'จำนวนความผิดปกติตาม{xlabel}', fontsize=15)
        plt.xlabel(xlabel)
        plt.ylabel('จำนวนความผิดปกติ')
        plt.grid(True, linestyle='--', alpha=0.7)
        
        # ปรับรูปแบบแกน x
        plt.xticks(rotation=45)
        
        # บันทึกกราฟ
        if save_fig:
            plt.savefig(f'{self.graphs_dir}/anomaly_count_by_{time_unit}.png')
        
        plt.close()
    
    def analyze_specific_anomaly(self, anomaly_type, feature=None, figsize=(12, 6), save_fig=True):
        """
        วิเคราะห์และแสดงผลความผิดปกติประเภทใดประเภทหนึ่งโดยเฉพาะ
        
        Args:
            anomaly_type: ประเภทของความผิดปกติที่ต้องการวิเคราะห์
            feature: คุณลักษณะที่ต้องการวิเคราะห์ (ถ้าไม่ระบุจะวิเคราะห์ทุกคุณลักษณะ)
            figsize: ขนาดของกราฟ
            save_fig: บันทึกรูปภาพหรือไม่
        """
        # ตรวจสอบว่ามีคอลัมน์ anomaly_type หรือไม่
        if 'anomaly_type' not in self.df.columns:
            print("ไม่พบคอลัมน์ anomaly_type ในข้อมูล")
            return
        
        # กรองข้อมูลเฉพาะความผิดปกติที่ต้องการ
        df_anomaly = self.df[(self.df['anomaly'] == 'anomaly') & 
                            (self.df['anomaly_type'] == anomaly_type)].copy()
        
        if len(df_anomaly) == 0:
            print(f"ไม่พบข้อมูลความผิดปกติประเภท '{anomaly_type}'")
            return
        
        print(f"===== การวิเคราะห์ความผิดปกติประเภท '{anomaly_type}' =====")
        print(f"จำนวนข้อมูล: {len(df_anomaly)} แถว")
        
        # แสดงช่วงเวลาที่พบความผิดปกติ
        min_date = df_anomaly['timestamp'].min()
        max_date = df_anomaly['timestamp'].max()
        print(f"ช่วงเวลาที่พบ: {min_date} ถึง {max_date}")
        
        # แสดงจำนวนความผิดปกติในแต่ละเซนเซอร์
        if 'sensor_id' in df_anomaly.columns:
            sensor_counts = df_anomaly['sensor_id'].value_counts()
            print("\nจำนวนความผิดปกติในแต่ละเซนเซอร์:")
            for sensor_id, count in sensor_counts.items():
                print(f"- {sensor_id}: {count} แถว")
        
        # ถ้าระบุคุณลักษณะเฉพาะ
        if feature:
            if feature in df_anomaly.columns:
                features_to_analyze = [feature]
            else:
                print(f"ไม่พบคุณลักษณะ {feature} ในข้อมูล")
                return
        else:
            # วิเคราะห์คุณลักษณะที่เป็นตัวเลขทั้งหมด
            features_to_analyze = df_anomaly.select_dtypes(include=['float64', 'int64']).columns
            features_to_analyze = [f for f in features_to_analyze if f not in ['anomaly']]
        
        # วิเคราะห์ค่าสถิติของแต่ละคุณลักษณะ
        print("\nสถิติของแต่ละคุณลักษณะ:")
        print(df_anomaly[features_to_analyze].describe())
        
        # แสดงกราฟการกระจายของแต่ละคุณลักษณะ
        for feat in features_to_analyze:
            plt.figure(figsize=figsize)
            
            # เปรียบเทียบการกระจายระหว่างข้อมูลปกติและข้อมูลผิดปกติ
            sns.histplot(data=self.df[self.df['anomaly'] == 'normal'], x=feat, 
                         color=self.colors['normal'], label='Normal', 
                         kde=True, alpha=0.5)
            
            sns.histplot(data=df_anomaly, x=feat, 
                         color=self.anomaly_colors.get(anomaly_type, 'red'), 
                         label=anomaly_type, kde=True, alpha=0.5)
            
            plt.title(f'การกระจายของ {feat} สำหรับความผิดปกติประเภท {anomaly_type}', fontsize=15)
            plt.xlabel(feat)
            plt.ylabel('ความถี่')
            plt.grid(True, linestyle='--', alpha=0.7)
            plt.legend()
            
            # บันทึกกราฟ
            if save_fig:
                plt.savefig(f'{self.graphs_dir}/{feat}_{anomaly_type}_distribution.png')
            
            plt.close()
    
    def run_full_analysis(self):
        """
        ทำการวิเคราะห์ข้อมูลเต็มรูปแบบและบันทึกผลลัพธ์
        """
        print("เริ่มการวิเคราะห์ข้อมูลเต็มรูปแบบ...")
        
        # แสดงภาพรวมข้อมูล
        self.show_data_overview()
        
        # วิเคราะห์ตามเวลา
        numeric_cols = self.df.select_dtypes(include=['float64', 'int64']).columns
        important_features = [col for col in ['temperature', 'humidity', 'vpd', 'ec', 'ph', 'co2'] 
                             if col in self.df.columns]
        
        # แสดงกราฟตามเวลา
        for feature in important_features:
            self.plot_time_series(feature=feature)
            self.plot_anomaly_types(feature=feature)
        
        # แสดงการกระจายข้อมูล
        for feature in important_features:
            self.plot_feature_distribution(feature=feature)
        
        # แสดงเมทริกซ์สหสัมพันธ์
        self.plot_correlation_matrix()
        
        # แสดงจำนวนความผิดปกติตามเวลา
        self.plot_anomaly_count_by_time(time_unit='day')
        
        # วิเคราะห์ความผิดปกติแต่ละประเภท
        if 'anomaly_type' in self.df.columns:
            anomaly_types = self.df[self.df['anomaly'] == 'anomaly']['anomaly_type'].unique()
            for anomaly_type in anomaly_types:
                if anomaly_type is not None:  # ข้ามค่า None
                    self.analyze_specific_anomaly(anomaly_type)
        
        print("วิเคราะห์ข้อมูลเสร็จสิ้น ผลลัพธ์ถูกบันทึกใน", self.graphs_dir)


def main():
    """
    ฟังก์ชันหลักสำหรับทดสอบการทำงานของคลาส SensorDataVisualizer
    """
    # โหลดข้อมูล
    visualizer = SensorDataVisualizer('data/sensor_anomaly_data.csv')
    
    # ทำการวิเคราะห์เต็มรูปแบบ
    visualizer.run_full_analysis()


if __name__ == "__main__":
    main()