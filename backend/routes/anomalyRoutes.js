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

// ===== Enhanced Rate Limiting =====
const anomalyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Max 50 anomaly reports per 5 minutes per IP
  message: {
    success: false,
    message: 'Too many anomaly reports. Please try again later.'
  },
  standardHeaders: true
});

const manualCheckLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Max 3 manual checks per 10 minutes per IP
  message: {
    success: false,
    message: 'Manual check rate limit exceeded. Please wait before trying again.'
  }
});

// ===== Enhanced Validation Schemas =====
const anomalyReportSchema = Joi.object({
  deviceId: Joi.string().required().max(50).pattern(/^[a-zA-Z0-9_-]+$/),
  timestamp: Joi.date().iso().required(),
  anomalyResults: Joi.object({
    rule_based_detection: Joi.array().items(
      Joi.object({
        is_anomaly: Joi.boolean().required(),
        anomaly_type: Joi.string().max(100),
        alert_level: Joi.string().valid('red', 'yellow', 'green'),
        message: Joi.string().max(500),
        timestamp: Joi.date().iso(),
        confidence: Joi.number().min(0).max(1),
        data: Joi.object()
      })
    ).required(),
    ml_detection: Joi.array().items(
      Joi.object({
        is_anomaly: Joi.boolean().required(),
        confidence: Joi.number().min(0).max(1),
        model_used: Joi.string().max(50),
        timestamp: Joi.date().iso()
      })
    ).required(),
    summary: Joi.object({
      rule_anomalies_found: Joi.boolean(),
      ml_anomalies_found: Joi.boolean(),
      total_anomalies: Joi.number().min(0),
      alert_level: Joi.string().valid('red', 'yellow', 'green'),
      priority_score: Joi.number().min(0),
      confidence_scores: Joi.object(),
      recommendations: Joi.array()
    })
  }).required(),
  alertLevel: Joi.string().valid('red', 'yellow', 'green').optional(),
  message: Joi.string().max(500).optional()
});

const anomalyQuerySchema = Joi.object({
  deviceId: Joi.string().max(50).optional(),
  resolved: Joi.boolean().optional(),
  alertLevel: Joi.string().valid('red', 'yellow', 'green', 'critical', 'high', 'medium', 'low').optional(),
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  sort: Joi.string().valid('timestamp', '-timestamp', 'alertLevel', '-alertLevel').default('-timestamp')
});

const statsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(7)
});

// ===== Validation Middleware =====
const validateAnomalyReport = (req, res, next) => {
  const { error } = anomalyReportSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: `Validation error: ${error.details[0].message}`,
      field: error.details[0].path.join('.'),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

const validateAnomalyQuery = (req, res, next) => {
  const { error, value } = anomalyQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      message: `Query validation error: ${error.details[0].message}`,
      field: error.details[0].path.join('.'),
      code: 'QUERY_VALIDATION_ERROR'
    });
  }
  req.validatedQuery = value;
  next();
};

const validateStatsQuery = (req, res, next) => {
  const { error, value } = statsQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      message: `Stats query validation error: ${error.details[0].message}`,
      field: error.details[0].path.join('.'),
      code: 'STATS_VALIDATION_ERROR'
    });
  }
  req.validatedQuery = value;
  next();
};

// ===== Helper Functions =====
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
    return {
      ...baseRecord,
      anomalyType: 'ml_detected',
      alertLevel: 'yellow', // Default for ML detection
      message: 'Machine learning model detected anomaly',
      mlResults: {
        confidence: detection.confidence || 0,
        model_used: detection.model_used || 'unknown'
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
    
    console.log(`📱 Push notification sent for anomaly ${anomaly._id}:`, 
               pushResult.success ? 'Success' : `Failed - ${pushResult.reason}`);
    
    return pushResult;
  } catch (pushError) {
    console.error(`❌ Failed to send push notification for anomaly ${anomaly._id}:`, pushError.message);
    return { success: false, error: pushError.message };
  }
};

// ===== Enhanced API Routes =====

// API: รับแจ้งเตือนจาก Python service (Enhanced with validation and error handling)
router.post('/anomalies', anomalyLimiter, validateAnomalyReport, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { deviceId, timestamp, anomalyResults, alertLevel, message } = req.body;
    
    console.log(`🚨 Received anomaly alert for device ${deviceId} at ${timestamp}`);
    
    // Verify device exists and get user info
    const device = await Device.findOne({ deviceId }).populate('userId', 'email');
    if (!device) {
      console.log(`⚠️ Device ${deviceId} not found in database`);
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

    // Process Rule-based detections
    if (anomalyResults.rule_based_detection && Array.isArray(anomalyResults.rule_based_detection)) {
      for (const detection of anomalyResults.rule_based_detection) {
        if (detection.is_anomaly) {
          try {
            const anomalyRecord = createAnomalyRecord(detection, deviceId, device.userId, 'rule_based');
            const anomaly = new Anomaly(anomalyRecord);
            await anomaly.save();
            anomalies.push(anomaly);
            
            // Send push notification
            const notificationResult = await sendAnomalyNotification(anomaly);
            if (notificationResult.success) {
              notificationsSent++;
            } else {
              notificationErrors++;
            }
            
          } catch (saveError) {
            console.error(`❌ Error saving rule-based anomaly:`, saveError);
          }
        }
      }
    }

    // Process ML detections
    if (anomalyResults.ml_detection && Array.isArray(anomalyResults.ml_detection)) {
      for (const detection of anomalyResults.ml_detection) {
        if (detection.is_anomaly) {
          try {
            const anomalyRecord = createAnomalyRecord(detection, deviceId, device.userId, 'ml_based');
            const anomaly = new Anomaly(anomalyRecord);
            await anomaly.save();
            anomalies.push(anomaly);
            
            // Send push notification
            const notificationResult = await sendAnomalyNotification(anomaly);
            if (notificationResult.success) {
              notificationsSent++;
            } else {
              notificationErrors++;
            }
            
          } catch (saveError) {
            console.error(`❌ Error saving ML-based anomaly:`, saveError);
          }
        }
      }
    }

    console.log(`✅ Processed ${anomalies.length} anomaly alerts for device ${deviceId}`);
    console.log(`📱 Notifications: ${notificationsSent} sent, ${notificationErrors} failed`);

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
    console.error('❌ Error processing anomaly alert:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error processing anomaly alert',
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

// API: ดูประวัติความผิดปกติ (Enhanced with pagination and filtering)
router.get('/anomalies', authenticateToken, validateAnomalyQuery, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = req.validatedQuery;
    
    // Build MongoDB filter
    const filter = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (query.deviceId) filter.deviceId = query.deviceId;
    if (query.resolved !== undefined) filter.resolved = query.resolved;
    if (query.alertLevel) filter.alertLevel = query.alertLevel;
    
    // Date filtering
    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
      if (query.endDate) filter.timestamp.$lte = new Date(query.endDate + "T23:59:59");
    }
    
    // Execute query with pagination
    const skip = (query.page - 1) * query.limit;
    
    const [anomalies, total] = await Promise.all([
      Anomaly.find(filter)
        .populate('resolvedBy', 'email name')
        .sort(query.sort)
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Anomaly.countDocuments(filter)
    ]);
    
    // Transform data for frontend compatibility
    const transformedAnomalies = anomalies.map(anomaly => ({
      _id: anomaly._id,
      device_id: anomaly.deviceId,
      device_name: anomaly.deviceId, // Could be enhanced to fetch actual device name
      type: anomaly.anomalyType,
      severity: anomaly.alertLevel,
      description: anomaly.message,
      timestamp: anomaly.timestamp,
      status: anomaly.resolved ? 'resolved' : 'unresolved',
      confidence_score: anomaly.mlResults?.confidence,
      data: anomaly.sensorData,
      resolved_at: anomaly.resolvedAt,
      resolved_by: anomaly.resolvedBy,
      resolution_notes: anomaly.notes,
      detection_method: anomaly.detectionMethod,
      created_at: anomaly.createdAt,
      updated_at: anomaly.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      data: {
        anomalies: transformedAnomalies,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
          hasNext: query.page < Math.ceil(total / query.limit),
          hasPrev: query.page > 1
        },
        filters: {
          deviceId: query.deviceId,
          resolved: query.resolved,
          alertLevel: query.alertLevel,
          dateRange: query.startDate || query.endDate ? {
            startDate: query.startDate,
            endDate: query.endDate
          } : null
        }
      }
    });
    
  } catch (err) {
    console.error('❌ Error fetching anomaly history:', err);
    next(err);
  }
});

// API: แก้ไขสถานะความผิดปกติ (Enhanced with validation)
router.put('/anomalies/:anomalyId/resolve', authenticateToken, async (req, res, next) => {
  try {
    const { anomalyId } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;
    
    // Validate anomalyId format
    if (!mongoose.Types.ObjectId.isValid(anomalyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid anomaly ID format',
        code: 'INVALID_ID'
      });
    }
    
    // Validate notes length
    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes too long (max 1000 characters)',
        code: 'NOTES_TOO_LONG'
      });
    }
    
    const anomaly = await Anomaly.findOneAndUpdate(
      { 
        _id: anomalyId, 
        userId: new mongoose.Types.ObjectId(userId),
        resolved: false // Only update unresolved anomalies
      },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: new mongoose.Types.ObjectId(userId),
          notes: notes || ''
        }
      },
      { new: true }
    ).populate('resolvedBy', 'email');
    
    if (!anomaly) {
      return res.status(404).json({ 
        success: false,
        message: 'Anomaly not found or already resolved',
        code: 'ANOMALY_NOT_FOUND'
      });
    }
    
    console.log(`✅ Anomaly ${anomalyId} resolved by user ${userId}`);
    
    // Send confirmation push notification
    try {
      await pushNotificationService.sendToUser(
        userId,
        'Anomaly Resolved',
        `Anomaly "${anomaly.anomalyType}" has been marked as resolved`,
        {
          type: 'anomaly_resolved',
          anomalyId: anomaly._id,
          deviceId: anomaly.deviceId
        },
        {
          type: 'system_update',
          priority: 'low'
        }
      );
      console.log(`📱 Resolution confirmation sent for anomaly ${anomalyId}`);
    } catch (pushError) {
      console.error(`❌ Failed to send resolution confirmation:`, pushError.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'Anomaly resolved successfully',
      data: {
        anomaly: {
          _id: anomaly._id,
          resolved: anomaly.resolved,
          resolvedAt: anomaly.resolvedAt,
          resolvedBy: anomaly.resolvedBy,
          notes: anomaly.notes
        }
      }
    });
    
  } catch (err) {
    console.error('❌ Error resolving anomaly:', err);
    next(err);
  }
});

// API: สถิติความผิดปกติ (Enhanced with better aggregation) - COMPLETE VERSION
router.get('/anomalies/stats', authenticateToken, validateStatsQuery, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days } = req.validatedQuery;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Execute multiple aggregations in parallel
    const [alertStats, dailyStats, deviceStats, overallStats] = await Promise.all([
      // Alert level statistics
      Anomaly.aggregate([
        {
          $match: {
            userId: userObjectId,
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$alertLevel',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]),
      
      // Daily statistics
      Anomaly.aggregate([
        {
          $match: {
            userId: userObjectId,
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
      ]),
      
      // Device statistics
      Anomaly.aggregate([
        {
          $match: {
            userId: userObjectId,
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
            },
            greenCount: {
              $sum: { $cond: [{ $eq: ['$alertLevel', 'green'] }, 1, 0] }
            },
            resolvedCount: {
              $sum: { $cond: ['$resolved', 1, 0] }
            },
            unresolvedCount: {
              $sum: { $cond: ['$resolved', 0, 1] }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]),
      
      // Overall statistics
      Anomaly.aggregate([
        {
          $match: {
            userId: userObjectId,
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalAnomalies: { $sum: 1 },
            resolvedCount: {
              $sum: { $cond: ['$resolved', 1, 0] }
            },
            unresolvedCount: {
              $sum: { $cond: ['$resolved', 0, 1] }
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  '$resolved',
                  { $subtract: ['$resolvedAt', '$timestamp'] },
                  null
                ]
              }
            }
          }
        }
      ])
    ]);

    // Calculate additional metrics
    const totalAnomalies = overallStats[0]?.totalAnomalies || 0;
    const resolvedCount = overallStats[0]?.resolvedCount || 0;
    const unresolvedCount = overallStats[0]?.unresolvedCount || 0;
    const avgResolutionTime = overallStats[0]?.avgResolutionTime || 0;

    // Calculate resolution rate
    const resolutionRate = totalAnomalies > 0 ? 
      parseFloat((resolvedCount / totalAnomalies * 100).toFixed(2)) : 0;

    // Convert average resolution time to hours
    const avgResolutionHours = avgResolutionTime > 0 ? 
      parseFloat((avgResolutionTime / (1000 * 60 * 60)).toFixed(2)) : 0;

    res.status(200).json({ 
      success: true,
      data: {
        total_anomalies: totalAnomalies,
        resolved_count: resolvedCount,
        unresolved_count: unresolvedCount,
        resolution_rate: resolutionRate,
        avg_resolution_time_hours: avgResolutionHours,
        alertStats,
        dailyStats,
        deviceStats,
        period: `${days} days`,
        generated_at: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ Error fetching anomaly stats:', err);
    next(err);
  }
});

// API: ตรวจสอบความผิดปกติสำหรับอุปกรณ์เฉพาะ (Enhanced manual check)
router.post('/devices/:deviceId/check-anomalies', authenticateToken, manualCheckLimiter, async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;
    
    // Validate deviceId format
    if (!deviceId || !/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format',
        code: 'INVALID_DEVICE_ID'
      });
    }
    
    // Verify device ownership
    const device = await Device.findOne({ 
      deviceId, 
      userId: new mongoose.Types.ObjectId(userId) 
    });
    
    if (!device) {
      return res.status(404).json({ 
        success: false,
        message: 'Device not found or access denied',
        code: 'DEVICE_NOT_FOUND'
      });
    }
    
    console.log(`🔍 Manual anomaly check initiated for device ${deviceId} by user ${userId}`);
    
    // Send start notification
    try {
      await pushNotificationService.sendToUser(
        userId,
        'Manual Check Started',
        `Anomaly detection check initiated for ${device.name}`,
        {
          type: 'manual_check',
          deviceId,
          deviceName: device.name
        },
        {
          type: 'system_update',
          priority: 'low'
        }
      );
    } catch (pushError) {
      console.error('❌ Failed to send manual check start notification:', pushError.message);
    }
    
    // Setup Python process
    const pythonPath = path.join(__dirname, '../anomaly-detection/integration_bridge.py');
    const pythonDir = path.join(__dirname, '../anomaly-detection');
    
    // Check if script exists
    const fs = require('fs');
    if (!fs.existsSync(pythonPath)) {
      return res.status(503).json({
        success: false,
        message: 'Anomaly detection service not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    const pythonProcess = spawn('python', [pythonPath, 'check', deviceId], {
      cwd: pythonDir,
      timeout: 30000 // 30 second timeout
    });
    
    let output = '';
    let error = '';
    let isTimeout = false;
    
    // Setup data handlers
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      isTimeout = true;
      pythonProcess.kill('SIGTERM');
    }, 30000);
    
    pythonProcess.on('close', async (code) => {
      clearTimeout(timeoutHandle);
      
      try {
        if (isTimeout) {
          console.error(`⏰ Manual anomaly check timeout for device ${deviceId}`);
          
          await pushNotificationService.sendToUser(
            userId,
            'Manual Check Timeout',
            `Anomaly detection check timed out for ${device.name}`,
            {
              type: 'manual_check_timeout',
              deviceId,
              deviceName: device.name
            },
            {
              type: 'system_update',
              priority: 'normal'
            }
          );
          
          return res.status(408).json({
            success: false,
            message: 'Manual anomaly check timed out',
            code: 'CHECK_TIMEOUT',
            timeout: true
          });
        }
        
        if (code === 0) {
          console.log(`✅ Manual anomaly check completed for device ${deviceId}`);
          
          // Parse output for anomaly results
          let anomalyResults = null;
          try {
            // Try to extract JSON from output
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              anomalyResults = JSON.parse(jsonMatch[0]);
            }
          } catch (parseError) {
            console.warn('⚠️ Could not parse anomaly results from output');
          }
          
          // Send completion notification
          await pushNotificationService.sendToUser(
            userId,
            'Manual Check Completed',
            `Anomaly detection check completed for ${device.name}`,
            {
              type: 'manual_check_complete',
              deviceId,
              deviceName: device.name,
              result: 'success',
              anomaliesFound: anomalyResults?.summary?.total_anomalies || 0
            },
            {
              type: 'system_update',
              priority: 'low'
            }
          );
          
          res.status(200).json({
            success: true,
            message: 'Manual anomaly check completed successfully',
            data: {
              deviceId,
              deviceName: device.name,
              output: output.trim(),
              anomalyResults,
              completedAt: new Date().toISOString()
            }
          });
          
        } else {
          console.error(`❌ Manual anomaly check failed for device ${deviceId}:`, error);
          
          // Send failure notification
          await pushNotificationService.sendToUser(
            userId,
            'Manual Check Failed',
            `Anomaly detection check failed for ${device.name}`,
            {
              type: 'manual_check_failed',
              deviceId,
              deviceName: device.name,
              error: error.trim()
            },
            {
              type: 'system_update',
              priority: 'normal'
            }
          );
          
          res.status(500).json({
            success: false,
            message: 'Manual anomaly check failed',
            error: error.trim(),
            code: 'CHECK_FAILED'
          });
        }
        
      } catch (notificationError) {
        console.error('❌ Error sending completion notification:', notificationError.message);
        
        // Still send response even if notification fails
        if (code === 0) {
          res.status(200).json({
            success: true,
            message: 'Manual check completed (notification failed)',
            data: {
              deviceId,
              deviceName: device.name,
              output: output.trim()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Manual check failed',
            error: error.trim(),
            code: 'CHECK_FAILED'
          });
        }
      }
    });
    
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutHandle);
      console.error(`❌ Python process error for device ${deviceId}:`, err);
      
      res.status(500).json({
        success: false,
        message: 'Failed to start anomaly detection process',
        error: err.message,
        code: 'PROCESS_ERROR'
      });
    });
    
  } catch (err) {
    console.error('❌ Error in manual anomaly check:', err);
    next(err);
  }
});

// API: Batch resolve anomalies (Enhanced with validation)
router.put('/anomalies/batch-resolve', authenticateToken, async (req, res, next) => {
  try {
    const { anomalyIds, notes } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!anomalyIds || !Array.isArray(anomalyIds)) {
      return res.status(400).json({
        success: false,
        message: 'anomalyIds array is required',
        code: 'MISSING_ANOMALY_IDS'
      });
    }
    
    if (anomalyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one anomaly ID is required',
        code: 'EMPTY_ANOMALY_IDS'
      });
    }
    
    if (anomalyIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 anomalies can be resolved at once',
        code: 'TOO_MANY_ANOMALIES'
      });
    }
    
    // Validate all IDs are valid ObjectIds
    const invalidIds = anomalyIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid anomaly ID format',
        invalidIds,
        code: 'INVALID_ANOMALY_IDS'
      });
    }
    
    // Validate notes length
    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes too long (max 1000 characters)',
        code: 'NOTES_TOO_LONG'
      });
    }
    
    const result = await Anomaly.updateMany(
      { 
        _id: { $in: anomalyIds.map(id => new mongoose.Types.ObjectId(id)) }, 
        userId: new mongoose.Types.ObjectId(userId),
        resolved: false 
      },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: new mongoose.Types.ObjectId(userId),
          notes: notes || 'Batch resolved'
        }
      }
    );
    
    console.log(`✅ Batch resolved ${result.modifiedCount} anomalies for user ${userId}`);
    
    // Send batch resolution notification
    if (result.modifiedCount > 0) {
      try {
        await pushNotificationService.sendToUser(
          userId,
          'Batch Resolution Complete',
          `Successfully resolved ${result.modifiedCount} anomalies`,
          {
            type: 'batch_resolved',
            count: result.modifiedCount,
            requestedCount: anomalyIds.length
          },
          {
            type: 'system_update',
            priority: 'low'
          }
        );
        console.log(`📱 Batch resolution notification sent to user ${userId}`);
      } catch (pushError) {
        console.error('❌ Failed to send batch resolution notification:', pushError.message);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Batch resolution completed',
      data: {
        resolvedCount: result.modifiedCount,
        requestedCount: anomalyIds.length,
        skippedCount: anomalyIds.length - result.modifiedCount
      }
    });
    
  } catch (err) {
    console.error('❌ Error in batch resolve:', err);
    next(err);
  }
});

// API: Health check สำหรับ anomaly detection service (Enhanced)
router.get('/anomalies/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check database connectivity
    const dbHealthy = mongoose.connection.readyState === 1;
    
    // Check push notification service
    let pushHealthy = false;
    let pushStats = null;
    try {
      pushStats = await pushNotificationService.getDeliveryStats(1);
      pushHealthy = true;
    } catch (error) {
      console.warn('⚠️ Push service health check failed:', error.message);
    }
    
    // Check recent anomaly processing
    const recentAnomalies = await Anomaly.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Check Python script existence
    const pythonPath = path.join(__dirname, '../anomaly-detection/integration_bridge.py');
    const fs = require('fs');
    const pythonScriptExists = fs.existsSync(pythonPath);
    
    const responseTime = Date.now() - startTime;
    const overallHealthy = dbHealthy && pushHealthy && pythonScriptExists;
    
    res.status(overallHealthy ? 200 : 503).json({
      success: true,
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          connection_state: mongoose.connection.readyState
        },
        anomaly_detection: {
          status: pythonScriptExists ? 'available' : 'unavailable',
          script_path: pythonPath,
          script_exists: pythonScriptExists
        },
        push_notifications: {
          status: pushHealthy ? 'healthy' : 'unhealthy',
          stats: pushStats
        }
      },
      metrics: {
        anomalies_last_24h: recentAnomalies,
        response_time_ms: responseTime
      },
      endpoints: [
        'POST /api/anomalies - Receive alerts from Python service',
        'GET /api/anomalies - Get anomaly history with filtering',
        'GET /api/anomalies/stats - Get comprehensive statistics',
        'PUT /api/anomalies/:id/resolve - Resolve single anomaly',
        'PUT /api/anomalies/batch-resolve - Batch resolve anomalies',
        'POST /api/devices/:id/check-anomalies - Manual anomaly check',
        'GET /api/anomalies/health - Health check endpoint',
        'GET /api/anomalies/types - Get anomaly types information'
      ],
      version: '2.0.0'
    });
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API: Get anomaly types and their descriptions
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

module.exports = router;