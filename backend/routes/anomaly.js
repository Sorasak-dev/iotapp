// ไฟล์: backend/routes/anomaly.js

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ตรวจสอบว่ามีโฟลเดอร์ temp หรือไม่
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// อ่านชื่อโมเดลที่ดีที่สุด
function getBestModelName() {
  const bestModelFile = path.join(__dirname, '../models/best_model.txt');
  
  if (fs.existsSync(bestModelFile)) {
    return fs.readFileSync(bestModelFile, 'utf8').trim();
  }
  
  return 'isolation_forest'; // ค่าเริ่มต้น
}

// ฟังก์ชันสำหรับตรวจจับความผิดปกติโดยเรียกใช้ Python script
function detectAnomaly(sensorData) {
  return new Promise((resolve, reject) => {
    // สร้างไฟล์ชั่วคราวเพื่อเก็บข้อมูลเซนเซอร์
    const tempDataFile = path.join(tempDir, `temp_data_${Date.now()}.json`);
    
    // เขียนข้อมูลลงในไฟล์ชั่วคราว
    fs.writeFileSync(tempDataFile, JSON.stringify(sensorData));
    
    // อ่านชื่อโมเดลที่ดีที่สุด
    const bestModel = getBestModelName();
    
    // เรียกใช้ Python script
    const pythonScript = path.join(__dirname, '../scripts/predict_anomaly.py');
    const pythonProcess = spawn('/Users/sorasaksanom/Documents/01 Projects/iotapp/backend/venv/bin/python', [  
      pythonScript,
      '--input', tempDataFile,
      '--model', bestModel
    ]);
    
    let result = '';
    let errorData = '';
    
    // รับข้อมูลจาก stdout
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    // รับข้อมูลจาก stderr
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    // เมื่อ Python script ทำงานเสร็จ
    pythonProcess.on('close', (code) => {
      // ลบไฟล์ชั่วคราว
      try {
        if (fs.existsSync(tempDataFile)) {
          fs.unlinkSync(tempDataFile);
        }
      } catch (err) {
        console.error('ไม่สามารถลบไฟล์ชั่วคราวได้:', err);
      }
      
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`Error: ${errorData}`);
        reject(new Error(`Python process failed: ${errorData}`));
        return;
      }
      
      try {
        // แปลงผลลัพธ์เป็น JSON
        const predictionResult = JSON.parse(result);
        resolve(predictionResult);
      } catch (error) {
        console.error('Failed to parse Python output:', error);
        reject(new Error(`Failed to parse prediction result: ${error.message}`));
      }
    });
  });
}

// API endpoint สำหรับตรวจจับความผิดปกติ
router.post('/api/anomaly/detect', async (req, res) => {
  try {
    const sensorData = req.body;
    
    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (!sensorData) {
      return res.status(400).json({ error: 'ไม่พบข้อมูลเซนเซอร์' });
    }
    
    // ตรวจสอบข้อมูลขั้นต่ำที่จำเป็น
    const requiredFields = ['temperature', 'humidity'];
    const missingFields = requiredFields.filter(field => !(field in sensorData));
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `ข้อมูลไม่ครบถ้วน กรุณาระบุ: ${missingFields.join(', ')}` 
      });
    }
    
    // เพิ่ม timestamp ถ้าไม่มี
    if (!sensorData.timestamp) {
      sensorData.timestamp = new Date().toISOString();
    }
    
    // ตรวจจับความผิดปกติ
    const result = await detectAnomaly(sensorData);
    
    // ส่งผลลัพธ์กลับไป
    res.json({
      success: true,
      data: {
        original_data: sensorData,
        prediction: result
      }
    });
    
  } catch (error) {
    console.error('Error detecting anomaly:', error);
    res.status(500).json({ 
      error: 'Failed to detect anomaly',
      message: error.message
    });
  }
});

// API endpoint สำหรับดึงสถานะโมเดล
router.get('/api/anomaly/status', (req, res) => {
  try {
    const bestModel = getBestModelName();
    
    // ตรวจสอบไฟล์โมเดล
    const modelPath = path.join(__dirname, '../models');
    const modelFile = path.join(modelPath, `${bestModel}_model.pkl`);
    const preprocessorFile = path.join(modelPath, 'preprocessor.pkl');
    const featureFile = path.join(modelPath, 'feature_columns.json');
    
    const modelExists = fs.existsSync(modelFile);
    const preprocessorExists = fs.existsSync(preprocessorFile);
    const featureExists = fs.existsSync(featureFile);
    
    let features = [];
    if (featureExists) {
      features = JSON.parse(fs.readFileSync(featureFile, 'utf8'));
    }
    
    res.json({
      success: true,
      data: {
        active_model: bestModel,
        model_ready: modelExists && preprocessorExists && featureExists,
        features: features,
        last_updated: modelExists ? new Date(fs.statSync(modelFile).mtime).toISOString() : null
      }
    });
    
  } catch (error) {
    console.error('Error getting model status:', error);
    res.status(500).json({ 
      error: 'Failed to get model status',
      message: error.message
    });
  }
});

// API endpoint สำหรับดึงประวัติ anomaly
router.get('/api/anomaly/history', (req, res) => {
  try {
    // ในระบบจริงควรดึงข้อมูลจากฐานข้อมูล
    // แต่ในตัวอย่างนี้ใช้ข้อมูลจำลอง
    const mockHistory = [
      {
        anomaly_type: 'อุณหภูมิสูงผิดปกติ',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        details: 'อุณหภูมิวัดได้ 42.5°C ซึ่งสูงกว่าค่าปกติ',
        anomaly_score: 0.87,
        resolved: false
      },
      {
        anomaly_type: 'ความชื้นต่ำผิดปกติ',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
        details: 'ความชื้นวัดได้ 15.2% ซึ่งต่ำกว่าค่าปกติ',
        anomaly_score: 0.75,
        resolved: true
      },
      {
        anomaly_type: 'ความผิดปกติในการเชื่อมต่อ',
        timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
        details: 'เซ็นเซอร์ขาดการเชื่อมต่อเป็นเวลานาน',
        anomaly_score: 0.92,
        resolved: true
      }
    ];
    
    res.json({
      success: true,
      history: mockHistory
    });
    
  } catch (error) {
    console.error('Error fetching anomaly history:', error);
    res.status(500).json({
      error: 'Failed to fetch anomaly history',
      message: error.message
    });
  }
});

module.exports = router;