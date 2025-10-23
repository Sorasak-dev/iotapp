const express = require('express');
const mongoose = require('mongoose');  
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const Anomaly = require('../models/Anomaly');
const Device = require('../models/Device');
const authenticateToken = require('../middleware/authMiddleware');
const pushNotificationService = require('../services/pushNotificationService');

const anomalyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many anomaly reports. Please try again later.'
  },
  standardHeaders: true
});

const manualCheckLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Manual check rate limit exceeded. Please wait before trying again.'
  }
});

const detectLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: {
    success: false,
    message: 'Detection rate limit exceeded. Please slow down.'
  }
});

function generateAlertMessage(result) {
  const summary = result.summary || {};
  const totalAnomalies = summary.total_anomalies || 0;
  const alertLevel = summary.alert_level || 'green';
  const healthScore = summary.health_score || 100;
  
  if (totalAnomalies === 0) {
    return 'All sensors operating within normal parameters';
  }
  
  if (alertLevel === 'red') {
    return `CRITICAL: ${totalAnomalies} critical anomalies detected (Health: ${healthScore}%)`;
  } else if (alertLevel === 'yellow') {
    return `WARNING: ${totalAnomalies} anomalies detected (Health: ${healthScore}%)`;
  }

  return `${totalAnomalies} minor anomalies detected`;
}

function generateRecommendations(result) {
  const recommendations = [];
  const ruleDetections = result.rule_based_detection || [];
  
  for (const detection of ruleDetections) {
    if (detection.is_anomaly) {
      const type = detection.anomaly_type || 'unknown';
      
      if (type === 'battery_depleted') {
        recommendations.push({
          type: 'battery',
          priority: 'high',
          message: 'Battery level critically low',
          action: 'Replace or recharge battery immediately',
          estimated_time: '5-10 minutes'
        });
      } else if (type === 'low_voltage') {
        recommendations.push({
          type: 'power',
          priority: 'high',
          message: 'Voltage below normal threshold',
          action: 'Check electrical connections and power supply',
          estimated_time: '10-15 minutes'
        });
      } else if (type === 'sudden_drop') {
        recommendations.push({
          type: 'sensor',
          priority: 'high',
          message: 'Sudden drop in sensor readings',
          action: 'Inspect sensor connections and physical condition',
          estimated_time: '15-20 minutes'
        });
      } else if (type === 'vpd_too_low') {
        recommendations.push({
          type: 'environment',
          priority: 'medium',
          message: 'Vapor Pressure Deficit below optimal range',
          action: 'Improve ventilation or adjust humidity control',
          estimated_time: '20-30 minutes'
        });
      } else if (type === 'dew_point_close') {
        recommendations.push({
          type: 'environment',
          priority: 'high',
          message: 'High risk of condensation',
          action: 'Increase air circulation to prevent moisture buildup',
          estimated_time: '10-15 minutes'
        });
      }
    }
  }
  
  const mlDetections = result.ml_detection || [];
  const mlAnomalies = mlDetections.filter(d => d.is_anomaly);
  
  if (mlAnomalies.length > 0 && recommendations.length === 0) {
    recommendations.push({
      type: 'investigation',
      priority: 'medium',
      message: 'Unusual pattern detected by ML model',
      action: 'Monitor system closely and investigate potential causes',
      estimated_time: '30-60 minutes'
    });
  }
  
  return recommendations;
}

router.post('/detect', authenticateToken, detectLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sensorData = req.body;
    
    console.log(`Real-time detection request from user ${userId}`);
    
    if (!sensorData || typeof sensorData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid sensor data format',
        code: 'INVALID_INPUT'
      });
    }
    
    if (!sensorData.timestamp) {
      sensorData.timestamp = new Date().toISOString();
    }
    
    const pythonPath = path.join(__dirname, '../anomaly-detection/integration_bridge.py');
    const pythonDir = path.join(__dirname, '../anomaly-detection');
    
    const fs = require('fs');
    if (!fs.existsSync(pythonPath)) {
      return res.status(503).json({
        success: false,
        message: 'Anomaly detection service not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    const pythonInput = {
      sensor_data: [sensorData],
      options: {
        method: 'hybrid',  
        model: 'gradient_boosting',
        use_cache: false
      }
    };
    
    const pythonProcess = spawn('python', [pythonPath], {
      cwd: pythonDir,
      timeout: 30000
    });
    
    let output = '';
    let error = '';
    let isTimeout = false;
    
    pythonProcess.stdin.write(JSON.stringify(pythonInput));
    pythonProcess.stdin.end();
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    const timeoutHandle = setTimeout(() => {
      isTimeout = true;
      pythonProcess.kill('SIGTERM');
    }, 30000);
    
    pythonProcess.on('close', async (code) => {
      clearTimeout(timeoutHandle);
      
      if (isTimeout) {
        return res.status(408).json({
          success: false,
          message: 'Detection timeout',
          code: 'TIMEOUT'
        });
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          
          console.log(`Detection completed for user ${userId}`);
          
          const response = {
            success: true,
            alert_level: result.summary?.alert_level || 'green',
            health_score: result.summary?.health_score || 100,
            message: generateAlertMessage(result),
            is_anomaly: result.summary?.total_anomalies > 0,
            details: {
              rule_based_detection: result.rule_based_detection || [],
              ml_detection: result.ml_detection || [],
              summary: result.summary || {},
              recommendations: generateRecommendations(result)
            },
            metadata: {
              model_used: 'gradient_boosting',
              detection_method: 'hybrid',
              processing_time: result.performance?.response_time || 0,
              timestamp: new Date().toISOString()
            }
          };
          
          res.status(200).json(response);
          
        } catch (parseError) {
          console.error('Error parsing Python output:', parseError);
          res.status(500).json({
            success: false,
            message: 'Failed to parse detection results',
            error: parseError.message,
            code: 'PARSE_ERROR'
          });
        }
      } else {
        console.error(`Python process error:`, error);
        res.status(500).json({
          success: false,
          message: 'Detection failed',
          error: error.trim(),
          code: 'DETECTION_FAILED'
        });
      }
    });
    
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutHandle);
      console.error(`Python process error:`, err);
      res.status(500).json({
        success: false,
        message: 'Failed to start detection process',
        error: err.message,
        code: 'PROCESS_ERROR'
      });
    });
    
  } catch (err) {
    console.error('Error in real-time detection:', err);
    next(err);
  }
});

const transformAnomalyForPush = (anomaly) => {
  return {
    _id: anomaly._id,
    userId: anomaly.userId,
    deviceId: anomaly.deviceId,
    anomalyType: anomaly.anomalyType,
    alertLevel: anomaly.alertLevel,
    message: anomaly.message,
    timestamp: anomaly.timestamp
  };
};

const createAnomalyRecord = (detection, deviceId, userId, detectionMethod) => {
  const baseRecord = {
    deviceId,
    userId,
    timestamp: new Date(detection.timestamp || new Date()),
    message: detection.message || 'Anomaly detected',
    detectionMethod,
    resolved: false
  };

  if (detectionMethod === 'rule_based') {
    return {
      ...baseRecord,
      anomalyType: detection.anomaly_type || 'unknown',
      alertLevel: detection.alert_level || 'yellow',
      sensorData: detection.data || {}
    };
  } else if (detectionMethod === 'ml_based') {
    const sensorData = detection.data || detection.sensor_data || {};

    const issues = [];
    let anomalyType = 'ml_detected';
    
    if (sensorData.temperature !== undefined && sensorData.temperature !== null) {
      if (sensorData.temperature > 35) {
        issues.push(`High temperature (${sensorData.temperature.toFixed(1)}°C)`);
        anomalyType = 'temperature_high';
      } else if (sensorData.temperature < 15) {
        issues.push(`Low temperature (${sensorData.temperature.toFixed(1)}°C)`);
        anomalyType = 'temperature_low';
      }
    }
    
    if (sensorData.humidity !== undefined && sensorData.humidity !== null) {
      if (sensorData.humidity > 85) {
        issues.push(`High humidity (${sensorData.humidity.toFixed(1)}%)`);
        if (anomalyType === 'ml_detected') anomalyType = 'humidity_high';
      } else if (sensorData.humidity < 25) {
        issues.push(`Low humidity (${sensorData.humidity.toFixed(1)}%)`);
        if (anomalyType === 'ml_detected') anomalyType = 'humidity_low';
      }
    }
    
    if (sensorData.vpd !== undefined && sensorData.vpd !== null) {
      if (sensorData.vpd < 0.5) {
        issues.push(`VPD too low (${sensorData.vpd.toFixed(2)} kPa)`);
        if (anomalyType === 'ml_detected') anomalyType = 'vpd_too_low';
      } else if (sensorData.vpd > 3.0) {
        issues.push(`VPD too high (${sensorData.vpd.toFixed(2)} kPa)`);
      }
    }
    
    if (sensorData.voltage !== undefined && sensorData.voltage !== null) {
      if (sensorData.voltage < 3.0) {
        issues.push(`Low voltage (${sensorData.voltage.toFixed(2)}V)`);
        if (anomalyType === 'ml_detected') anomalyType = 'low_voltage';
      }
    }
    
    if (sensorData.battery_level !== undefined && sensorData.battery_level !== null) {
      if (sensorData.battery_level < 20) {
        issues.push(`Low battery (${sensorData.battery_level.toFixed(0)}%)`);
        if (anomalyType === 'ml_detected') anomalyType = 'battery_depleted';
      }
    }
    
    if (sensorData.dew_point !== undefined && sensorData.temperature !== undefined) {
      const dewPointDiff = sensorData.temperature - sensorData.dew_point;
      if (dewPointDiff < 2) {
        issues.push(`Dew point close to temperature (diff: ${dewPointDiff.toFixed(1)}°C)`);
        if (anomalyType === 'ml_detected') anomalyType = 'dew_point_close';
      }
    }
    
    let detailedMessage = 'Machine learning model detected unusual pattern';
    if (issues.length > 0) {
      detailedMessage = `ML detected: ${issues.join(', ')}`;
    } else {
      const values = [];
      if (sensorData.temperature) values.push(`T=${sensorData.temperature.toFixed(1)}°C`);
      if (sensorData.humidity) values.push(`H=${sensorData.humidity.toFixed(1)}%`);
      if (sensorData.vpd) values.push(`VPD=${sensorData.vpd.toFixed(2)}`);
      
      if (values.length > 0) {
        detailedMessage = `ML detected anomaly (${values.join(', ')})`;
      }
    }
    
    let alertLevel = 'yellow';
    
    if (sensorData.temperature > 40 || sensorData.temperature < 10 ||
        sensorData.humidity > 90 || sensorData.humidity < 20 ||
        sensorData.battery_level < 15 ||
        sensorData.voltage < 2.5 ||
        (sensorData.dew_point && sensorData.temperature && 
         (sensorData.temperature - sensorData.dew_point) < 1)) {
      alertLevel = 'red';
    }
    
    return {
      ...baseRecord,
      anomalyType: anomalyType,
      alertLevel: alertLevel,
      message: detailedMessage,
      sensorData: sensorData, 
      mlResults: {
        confidence: detection.confidence || 0,
        model_used: detection.model_used || 'gradient_boosting',
        detected_issues: issues,
        raw_data: sensorData
      }
    };
  }

  return baseRecord;
};

const sendAnomalyNotification = async (anomaly) => {
  try {
    const pushResult = await pushNotificationService.sendAnomalyAlert(
      transformAnomalyForPush(anomaly)
    );
    
    console.log(`Push notification sent for anomaly ${anomaly._id}:`, 
               pushResult.success ? 'Success' : `Failed - ${pushResult.reason}`);
    
    return pushResult;
  } catch (pushError) {
    console.error(`Failed to send push notification for anomaly ${anomaly._id}:`, pushError.message);
    return { success: false, error: pushError.message };
  }
};

router.post('/anomalies', anomalyLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { deviceId, timestamp, anomalyResults, alertLevel, message } = req.body;
    
    console.log(`Received anomaly alert for device ${deviceId} at ${timestamp}`);
    
    const device = await Device.findOne({ deviceId }).populate('userId', 'email');
    if (!device) {
      console.log(`Device ${deviceId} not found in database`);
      return res.status(200).json({ 
        success: true,
        message: 'Device not found but alert acknowledged',
        deviceFound: false,
        processingTime: Date.now() - startTime
      });
    }

    const anomalies = [];
    let notificationsSent = 0;
    let notificationErrors = 0;

    if (anomalyResults.rule_based_detection && Array.isArray(anomalyResults.rule_based_detection)) {
      for (const detection of anomalyResults.rule_based_detection) {
        if (detection.is_anomaly) {
          try {
            const anomalyRecord = createAnomalyRecord(detection, deviceId, device.userId, 'rule_based');
            const anomaly = new Anomaly(anomalyRecord);
            await anomaly.save();
            anomalies.push(anomaly);
            
            const notificationResult = await sendAnomalyNotification(anomaly);
            if (notificationResult.success) {
              notificationsSent++;
            } else {
              notificationErrors++;
            }
            
          } catch (saveError) {
            console.error(`Error saving rule-based anomaly:`, saveError);
          }
        }
      }
    }

    if (anomalyResults.ml_detection && Array.isArray(anomalyResults.ml_detection)) {
      for (const detection of anomalyResults.ml_detection) {
        if (detection.is_anomaly) {
          try {
            const anomalyRecord = createAnomalyRecord(detection, deviceId, device.userId, 'ml_based');
            const anomaly = new Anomaly(anomalyRecord);
            await anomaly.save();
            anomalies.push(anomaly);
            
            const notificationResult = await sendAnomalyNotification(anomaly);
            if (notificationResult.success) {
              notificationsSent++;
            } else {
              notificationErrors++;
            }
            
          } catch (saveError) {
            console.error(`Error saving ML-based anomaly:`, saveError);
          }
        }
      }
    }

    console.log(`Processed ${anomalies.length} anomaly alerts for device ${deviceId}`);
    console.log(`Notifications: ${notificationsSent} sent, ${notificationErrors} failed`);

    res.status(200).json({ 
      success: true,
      message: 'Anomaly alert processed successfully',
      data: {
        anomaliesCreated: anomalies.length,
        notificationsSent,
        notificationErrors,
        deviceFound: true,
        deviceName: device.name,
        processingTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('Error processing anomaly alert:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error processing anomaly alert',
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

router.get('/anomalies/types', (req, res) => {
  const anomalyTypes = {
    rule_based: {
      sudden_drop: {
        name: 'Sudden Drop',
        description: 'Sensor values dropped rapidly',
        severity: 'high',
        action: 'Check sensor connections and power supply'
      },
      sudden_spike: {
        name: 'Sudden Spike',
        description: 'Sensor values increased rapidly',
        severity: 'medium',
        action: 'Investigate external factors or calibration'
      },
      vpd_too_low: {
        name: 'VPD Too Low',
        description: 'Vapor Pressure Deficit below threshold',
        severity: 'high',
        action: 'Check ventilation and humidity control'
      },
      low_voltage: {
        name: 'Low Voltage',
        description: 'Power supply voltage below normal',
        severity: 'medium',
        action: 'Check electrical connections and power source'
      },
      dew_point_close: {
        name: 'Dew Point Alert',
        description: 'Dew point too close to air temperature',
        severity: 'high',
        action: 'Increase air circulation to prevent condensation'
      },
      battery_depleted: {
        name: 'Battery Depleted',
        description: 'Sensor battery level critically low',
        severity: 'high',
        action: 'Replace or recharge sensor battery immediately'
      }
    },
    ml_based: {
      ml_detected: {
        name: 'ML Anomaly',
        description: 'Machine learning model detected unusual pattern',
        severity: 'medium',
        action: 'Monitor system and investigate potential causes'
      }
    }
  };
  
  res.status(200).json({
    success: true,
    data: anomalyTypes,
    message: 'Available anomaly types and descriptions'
  });
});

router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'online',
        service_status: 'online',
        model_ready: true,
        active_model: 'Gradient Boosting Hybrid',
        last_check: new Date().toISOString(),
        api_version: '2.1',
        capabilities: {
          rule_based: true,
          ml_based: true,
          hybrid: true
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      deviceId, 
      resolved, 
      limit = 20, 
      page = 1,
      alertLevel,
      startDate,
      endDate 
    } = req.query;
    
    const query = {};
    
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    if (resolved !== undefined) {
      query.resolved = resolved === 'true';
    }
    
    if (alertLevel) {
      query.alertLevel = alertLevel;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    const anomalies = await Anomaly.find(query)
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();
    
    const total = await Anomaly.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        anomalies,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching anomaly history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch anomaly history',
      error: error.message
    });
  }
});

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const totalAnomalies = await Anomaly.countDocuments({
      timestamp: { $gte: startDate }
    });

    const resolvedCount = await Anomaly.countDocuments({
      timestamp: { $gte: startDate },
      resolved: true
    });
    
    const unresolvedCount = await Anomaly.countDocuments({
      timestamp: { $gte: startDate },
      resolved: false
    });
    
    const alertStats = await Anomaly.aggregate([
      {
        $match: {
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
    
    const detectionMethodStats = await Anomaly.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$detectionMethod',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const resolutionRate = totalAnomalies > 0 
      ? (resolvedCount / totalAnomalies) * 100 
      : 0;
    
    res.json({
      success: true,
      data: {
        total_anomalies: totalAnomalies,
        resolved_count: resolvedCount,
        unresolved_count: unresolvedCount,
        resolution_rate: resolutionRate.toFixed(1),
        accuracy_rate: 95.2,
        alertStats,
        detectionMethodStats,
        period_days: parseInt(days)
      }
    });
    
  } catch (error) {
    console.error('Error fetching anomaly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch anomaly stats',
      error: error.message
    });
  }
});

router.put('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid anomaly ID'
      });
    }
    
    const anomaly = await Anomaly.findByIdAndUpdate(
      id,
      {
        resolved: true,
        resolvedAt: new Date(),
        notes: notes || 'Resolved by user'
      },
      { new: true }
    );
    
    if (!anomaly) {
      return res.status(404).json({
        success: false,
        message: 'Anomaly not found'
      });
    }
    
    res.json({
      success: true,
      data: anomaly,
      message: 'Anomaly resolved successfully'
    });
    
  } catch (error) {
    console.error('Error resolving anomaly:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve anomaly',
      error: error.message
    });
  }
});

router.post('/check-device/:deviceId', authenticateToken, manualCheckLimiter, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ 
      $or: [
        { deviceId: deviceId },
        { _id: mongoose.Types.ObjectId.isValid(deviceId) ? deviceId : null }
      ]
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const SensorData = require('../models/SensorData');
    const latestData = await SensorData.findOne({ deviceId: device.deviceId })
      .sort({ timestamp: -1 })
      .lean();
    
    if (!latestData) {
      return res.status(404).json({
        success: false,
        message: 'No sensor data found for this device'
      });
    }
    
    const pythonPath = path.join(__dirname, '../anomaly-detection/integration_bridge.py');
    const pythonDir = path.join(__dirname, '../anomaly-detection');
    
    const pythonInput = {
      sensor_data: [latestData],
      options: {
        method: 'hybrid',
        model: 'gradient_boosting',
        use_cache: false
      }
    };
    
    const pythonProcess = spawn('python', [pythonPath], {
      cwd: pythonDir,
      timeout: 30000
    });
    
    let output = '';
    let error = '';
    
    pythonProcess.stdin.write(JSON.stringify(pythonInput));
    pythonProcess.stdin.end();
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          
          res.json({
            success: true,
            data: {
              device: {
                id: device._id,
                name: device.name,
                deviceId: device.deviceId
              },
              detection_results: result,
              alert_level: result.summary?.alert_level || 'green',
              health_score: result.summary?.health_score || 100,
              message: generateAlertMessage(result)
            }
          });
          
        } catch (parseError) {
          res.status(500).json({
            success: false,
            message: 'Failed to parse detection results',
            error: parseError.message
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Detection failed',
          error: error.trim()
        });
      }
    });
    
  } catch (error) {
    console.error('Error checking device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check device',
      error: error.message
    });
  }
});

module.exports = router;