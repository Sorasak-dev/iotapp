const express = require('express');
const mongoose = require('mongoose');  
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const Anomaly = require('../models/Anomaly');
const Device = require('../models/Device');
const authenticateToken = require('../middleware/authMiddleware');

// API: รับแจ้งเตือนจาก Python service
router.post('/anomalies', async (req, res) => {
  try {
    const { deviceId, timestamp, anomalyResults, alertLevel, message } = req.body;
    
    console.log(`🚨 Received anomaly alert for device ${deviceId}`);
    
    // หา device และ userId
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.log(`⚠️ Device ${deviceId} not found in database`);
      // ยังคงส่ง success response เพื่อไม่ให้ Python service error
      return res.status(200).json({ 
        message: 'Device not found but alert acknowledged',
        deviceFound: false 
      });
    }
    
    // สร้างข้อมูล anomaly records
    const anomalies = [];
    
    // จาก Rule-based detection
    if (anomalyResults.rule_based_detection) {
      for (const detection of anomalyResults.rule_based_detection) {
        if (detection.is_anomaly) {
          anomalies.push({
            deviceId,
            userId: device.userId,
            timestamp: new Date(detection.timestamp || timestamp),
            anomalyType: detection.anomaly_type,
            alertLevel: detection.alert_level,
            message: detection.message,
            detectionMethod: 'rule_based',
            sensorData: detection.data || {},
            resolved: false
          });
        }
      }
    }
    
    // จาก ML detection
    if (anomalyResults.ml_detection) {
      for (const detection of anomalyResults.ml_detection) {
        if (detection.is_anomaly) {
          anomalies.push({
            deviceId,
            userId: device.userId,
            timestamp: new Date(detection.timestamp || timestamp),
            anomalyType: 'ml_detected',
            alertLevel: alertLevel || 'yellow',
            message: 'Machine learning model detected anomaly',
            detectionMethod: 'ml_based',
            mlResults: {
              confidence: detection.confidence,
              model_used: detection.model_used
            },
            resolved: false
          });
        }
      }
    }
    
    // บันทึกลงฐานข้อมูล
    if (anomalies.length > 0) {
      await Anomaly.insertMany(anomalies);
      console.log(`✅ Saved ${anomalies.length} anomaly alerts for device ${deviceId}`);
    }
    
    res.status(200).json({ 
      message: 'Anomaly alert received and processed',
      anomaliesCreated: anomalies.length,
      deviceFound: true
    });
    
  } catch (error) {
    console.error('❌ Error processing anomaly alert:', error);
    res.status(500).json({ 
      message: 'Error processing alert',
      error: error.message 
    });
  }
});

// API: ดูประวัติความผิดปกติ
router.get('/anomalies', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      deviceId, 
      resolved, 
      alertLevel, 
      page = 1, 
      limit = 20,
      startDate,
      endDate 
    } = req.query;
    
    // สร้าง query filter
    const filter = { userId };
    
    if (deviceId) filter.deviceId = deviceId;
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    if (alertLevel) filter.alertLevel = alertLevel;
    
    // กรองตามวันที่
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate + "T23:59:59");
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // ดึงข้อมูล
    const anomalies = await Anomaly.find(filter)
      .populate('resolvedBy', 'email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Anomaly.countDocuments(filter);
    
    res.status(200).json({
      anomalies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (err) {
    next(err);
  }
});

// API: แก้ไขสถานะความผิดปกติ
router.put('/anomalies/:anomalyId/resolve', authenticateToken, async (req, res, next) => {
  try {
    const { anomalyId } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;
    
    const anomaly = await Anomaly.findOneAndUpdate(
      { _id: anomalyId, userId },
      {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
        notes: notes || ''
      },
      { new: true }
    );
    
    if (!anomaly) {
      return res.status(404).json({ message: 'Anomaly not found' });
    }
    
    console.log(`✅ Anomaly ${anomalyId} resolved by user ${userId}`);
    
    res.status(200).json({
      message: 'Anomaly resolved successfully',
      anomaly
    });
    
  } catch (err) {
    next(err);
  }
});

// API: สถิติความผิดปกติ
router.get('/anomalies/stats', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // สถิติตาม alert level
    const alertStats = await Anomaly.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$alertLevel',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // สถิติรายวัน
    const dailyStats = await Anomaly.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            alertLevel: '$alertLevel'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    // สถิติตาม device
    const deviceStats = await Anomaly.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$deviceId',
          count: { $sum: 1 },
          redCount: {
            $sum: { $cond: [{ $eq: ['$alertLevel', 'red'] }, 1, 0] }
          },
          yellowCount: {
            $sum: { $cond: [{ $eq: ['$alertLevel', 'yellow'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.status(200).json({ 
      alertStats,
      dailyStats,
      deviceStats,
      period: `${days} days`
    });
    
  } catch (err) {
    next(err);
  }
});

// API: ตรวจสอบความผิดปกติสำหรับอุปกรณ์เฉพาะ (Manual check)
router.post('/devices/:deviceId/check-anomalies', authenticateToken, async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;
    
    // ตรวจสอบว่าอุปกรณ์เป็นของผู้ใช้
    const device = await Device.findOne({ deviceId, userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    // เรียกใช้ Python script
    const pythonPath = path.join(__dirname, '../anomaly-detection/integration_example.py');
    const pythonDir = path.join(__dirname, '../anomaly-detection');
    
    console.log(`🔍 Manual anomaly check for device ${deviceId}`);
    
    const pythonProcess = spawn('python', [pythonPath, 'check', deviceId], {
      cwd: pythonDir
    });
    
    let output = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Manual anomaly check completed for device ${deviceId}`);
        res.status(200).json({
          message: 'Anomaly detection completed',
          deviceId,
          output: output.trim(),
          success: true
        });
      } else {
        console.error(`❌ Manual anomaly check failed for device ${deviceId}:`, error);
        res.status(500).json({
          message: 'Anomaly detection failed',
          error: error.trim(),
          success: false
        });
      }
    });
    
    // Timeout หลัง 30 วินาที
    setTimeout(() => {
      pythonProcess.kill();
      res.status(408).json({ 
        message: 'Anomaly detection timeout',
        timeout: true 
      });
    }, 30000);
    
  } catch (err) {
    next(err);
  }
});

// API: Health check สำหรับ anomaly detection service
router.get('/anomalies/health', (req, res) => {
  res.status(200).json({
    message: 'Anomaly Detection API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/anomalies - Receive alerts from Python service',
      'GET /api/anomalies - Get anomaly history',
      'GET /api/anomalies/stats - Get anomaly statistics',
      'PUT /api/anomalies/:id/resolve - Resolve anomaly',
      'POST /api/devices/:id/check-anomalies - Manual check',
      'GET /api/anomalies/health - Health check'
    ]
  });
});

module.exports = router;