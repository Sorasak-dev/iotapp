import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import OneClassSVM
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

# กำหนด seed สำหรับการทำงานที่สม่ำเสมอ
np.random.seed(42)

class SensorAnomalyDetector:
    """
    คลาสสำหรับฝึกฝนและประเมินโมเดล Anomaly Detection
    สำหรับข้อมูลจากเซนเซอร์
    """
    
    def __init__(self):
        """ตั้งค่าเริ่มต้นสำหรับตัวตรวจจับความผิดปกติ"""
        self.models = {}
        self.preprocessor = None
        self.feature_columns = None
        
    def load_data(self, file_path):
        """
        โหลดข้อมูลจากไฟล์ CSV
        
        Args:
            file_path: ตำแหน่งของไฟล์ CSV
            
        Returns:
            DataFrame ที่โหลดจากไฟล์
        """
        df = pd.read_csv(file_path)
        
        # แปลง timestamp เป็น datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # เพิ่มคุณลักษณะเกี่ยวกับเวลา
        df['hour'] = df['timestamp'].dt.hour
        df['dayofweek'] = df['timestamp'].dt.dayofweek
        df['month'] = df['timestamp'].dt.month
        
        # แทนที่ค่า NaN ในคอลัมน์ตัวเลขด้วยค่าเฉลี่ย
        numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
        
        # แทนที่ค่า NaN ในคอลัมน์ข้อความด้วยค่าที่พบบ่อยที่สุด
        categorical_cols = df.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            if col != 'anomaly_type':  # ไม่ต้องแทนที่ anomaly_type เพราะเป็นเป้าหมาย
                df[col] = df[col].fillna(df[col].mode()[0])
        
        return df
    
    def prepare_features(self, df):
        """
        เตรียมคุณลักษณะสำหรับโมเดล
        
        Args:
            df: DataFrame ที่มีข้อมูลเซนเซอร์
            
        Returns:
            X: คุณลักษณะที่เตรียมแล้ว
            y: ป้ายกำกับ (normal หรือ anomaly)
        """
        # ตรวจสอบว่ามีคอลัมน์ 'data_delay' หรือไม่
        if 'data_delay' not in df.columns:
            df['data_delay'] = 0  # ถ้าไม่มีให้เติมค่า 0
        
        # กำหนดคอลัมน์ที่ใช้เป็นคุณลักษณะ
        self.feature_columns = [
            'temperature', 'humidity', 'vpd', 'dew_point', 
            'ec', 'ph', 'co2', 'hour', 'dayofweek'
        ]
        
        # คอลัมน์ categorical สำหรับการแปลงด้วย OneHotEncoder
        categorical_cols = ['sensor_id']
        
        # ตรวจสอบว่ามีคุณลักษณะที่ต้องการหรือไม่
        available_features = []
        for col in self.feature_columns:
            if col in df.columns:
                available_features.append(col)
        
        self.feature_columns = available_features
        
        # สร้าง preprocessor สำหรับแปลงข้อมูล
        numeric_transformer = StandardScaler()
        categorical_transformer = OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore')
        
        transformers = [('num', numeric_transformer, self.feature_columns)]
        if set(categorical_cols).issubset(df.columns):
            transformers.append(('cat', categorical_transformer, categorical_cols))
        
        self.preprocessor = ColumnTransformer(transformers=transformers)
        
        # เตรียมคุณลักษณะและป้ายกำกับ
        X = df[self.feature_columns + [col for col in categorical_cols if col in df.columns]]
        y = (df['anomaly'] == 'anomaly').astype(int)  # แปลงเป็น 0 (normal) และ 1 (anomaly)
        
        return X, y
    
    def train_models(self, X_train):
        """
        ฝึกฝนโมเดล anomaly detection
        
        Args:
            X_train: คุณลักษณะสำหรับการฝึกฝน
        """
        # สร้างและฝึกฝนโมเดล Isolation Forest
        self.models['isolation_forest'] = IsolationForest(
            n_estimators=100, 
            contamination=0.2,  # ควรตั้งค่าให้ใกล้เคียงกับสัดส่วนของ anomaly ในข้อมูล
            random_state=42
        )
        
        # สร้างและฝึกฝนโมเดล Local Outlier Factor
        self.models['local_outlier_factor'] = LocalOutlierFactor(
            n_neighbors=20,
            contamination=0.2,
            novelty=True  # ตั้งค่า novelty=True เพื่อให้สามารถใช้ predict ได้
        )
        
        # สร้างและฝึกฝนโมเดล One-Class SVM
        self.models['one_class_svm'] = OneClassSVM(
            kernel='rbf',
            nu=0.2,  # ค่า nu ควรใกล้เคียงกับสัดส่วนของความผิดปกติ
            gamma='scale'
        )
        
        # ฝึกฝนโมเดลทั้งหมด
        X_train_scaled = self.preprocessor.fit_transform(X_train)
        
        for name, model in self.models.items():
            print(f"กำลังฝึกฝนโมเดล {name}...")
            model.fit(X_train_scaled)
    
    def evaluate_models(self, X_test, y_test):
        """
        ประเมินประสิทธิภาพของโมเดล
        
        Args:
            X_test: คุณลักษณะสำหรับการทดสอบ
            y_test: ป้ายกำกับทีีถูกต้องสำหรับการทดสอบ
            
        Returns:
            Dictionary ที่เก็บผลการประเมินของแต่ละโมเดล
        """
        results = {}
        X_test_scaled = self.preprocessor.transform(X_test)
        
        for name, model in self.models.items():
            print(f"\nประเมินโมเดล {name}:")
            
            # ทำนาย (1: ปกติ, -1: ผิดปกติ สำหรับ Isolation Forest และ One-Class SVM)
            if name in ['isolation_forest', 'one_class_svm']:
                y_pred = model.predict(X_test_scaled)
                # แปลงค่าให้เป็น 0 (ปกติ) และ 1 (ผิดปกติ)
                y_pred = np.where(y_pred == 1, 0, 1)
            else:
                # สำหรับ LocalOutlierFactor
                y_pred = model.predict(X_test_scaled)
                y_pred = np.where(y_pred == 1, 0, 1)
            
            # คำนวณเมทริกซ์ความสับสน (Confusion Matrix)
            cm = confusion_matrix(y_test, y_pred)
            
            # คำนวณรายงานการจำแนกประเภท (Classification Report)
            report = classification_report(y_test, y_pred, target_names=['normal', 'anomaly'])
            
            print("Confusion Matrix:")
            print(cm)
            print("\nClassification Report:")
            print(report)
            
            results[name] = {
                'confusion_matrix': cm,
                'classification_report': report,
                'predictions': y_pred
            }
        
        return results
    
    def plot_confusion_matrix(self, cm, model_name):
        """
        แสดงกราฟิกเมทริกซ์ความสับสน
        
        Args:
            cm: เมทริกซ์ความสับสน
            model_name: ชื่อของโมเดล
        """
        plt.figure(figsize=(8, 6))
        plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
        plt.title(f'Confusion Matrix - {model_name}')
        plt.colorbar()
        
        classes = ['Normal', 'Anomaly']
        tick_marks = np.arange(len(classes))
        plt.xticks(tick_marks, classes, rotation=45)
        plt.yticks(tick_marks, classes)
        
        # แสดงค่าในแต่ละช่อง
        thresh = cm.max() / 2.
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                plt.text(j, i, cm[i, j],
                        horizontalalignment="center",
                        color="white" if cm[i, j] > thresh else "black")
        
        plt.tight_layout()
        plt.ylabel('True label')
        plt.xlabel('Predicted label')
        plt.savefig(f'results/graphs/confusion_matrix_{model_name}.png')
        plt.close()
    
    def run_pipeline(self, train_file, test_file=None):
        """
        ทำงานกระบวนการทั้งหมดของการฝึกฝนและประเมินผล
        
        Args:
            train_file: ไฟล์ข้อมูลสำหรับฝึกฝน
            test_file: ไฟล์ข้อมูลสำหรับทดสอบ (ถ้าไม่ระบุจะแบ่งจากข้อมูลฝึกฝน)
            
        Returns:
            ผลการประเมินของโมเดลทั้งหมด
        """
        # โหลดข้อมูลฝึกฝน
        print("กำลังโหลดข้อมูล...")
        train_df = self.load_data(train_file)
        
        # ถ้าไม่ระบุไฟล์ทดสอบ ให้แบ่งข้อมูลฝึกฝน
        if test_file is None:
            print("ไม่ได้ระบุไฟล์ทดสอบ จะแบ่งข้อมูลฝึกฝนเป็นส่วนทดสอบ 20%")
            train_df, test_df = train_test_split(train_df, test_size=0.2, random_state=42)
        else:
            test_df = self.load_data(test_file)
        
        # เตรียมคุณลักษณะ
        print("กำลังเตรียมคุณลักษณะ...")
        X_train, y_train = self.prepare_features(train_df)
        X_test, y_test = self.prepare_features(test_df)
        
        # ฝึกฝนโมเดล
        print("กำลังฝึกฝนโมเดล...")
        self.train_models(X_train)
        
        # ประเมินโมเดล
        print("กำลังประเมินโมเดล...")
        results = self.evaluate_models(X_test, y_test)
        
        # แสดงเมทริกซ์ความสับสนของแต่ละโมเดล
        for name, result in results.items():
            self.plot_confusion_matrix(result['confusion_matrix'], name)
        
        return results


def main():
    """
    ฟังก์ชันหลักสำหรับการทดสอบชุดโค้ด
    """
    # สร้างตัวตรวจจับความผิดปกติ
    detector = SensorAnomalyDetector()
    
    # ทำงานกระบวนการทั้งหมด
    results = detector.run_pipeline(
        train_file='data/sensor_anomaly_train.csv',
        test_file='data/sensor_anomaly_test.csv'
    )
    
    # สรุปผลการประเมิน
    print("\n=== สรุปผลการเปรียบเทียบโมเดล ===")
    for name, result in results.items():
        # ดึงค่า F1-score ของคลาส anomaly จาก classification_report
        lines = result['classification_report'].split('\n')
        anomaly_line = [line for line in lines if 'anomaly' in line][0]
        f1_score = float(anomaly_line.split()[3])
        
        print(f"โมเดล {name}: F1-score สำหรับการตรวจจับความผิดปกติ = {f1_score:.4f}")


if __name__ == "__main__":
    main()