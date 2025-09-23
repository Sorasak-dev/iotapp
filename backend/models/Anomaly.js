const mongoose = require('mongoose');

// Schema สำหรับ Anomaly Detection API v2.1 - Clean Version
const anomalySchema = new mongoose.Schema({
  // ข้อมูลพื้นฐาน
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // ข้อมูลเซนเซอร์ที่ใช้ในการตรวจจับ
  sensorData: {
    temperature: { type: Number, default: null },
    humidity: { type: Number, default: null },
    co2: { type: Number, default: null },
    ec: { type: Number, default: null },
    ph: { type: Number, default: null },
    voltage: { type: Number, default: null },
    battery_level: { type: Number, default: null },
    dew_point: { type: Number, default: null },
    vpd: { type: Number, default: null }
  },
  
  // ผลการตรวจจับจาก Rule-based
  ruleBasedDetection: {
    anomaliesFound: { type: Boolean, default: false },
    anomalies: [{
      type: { type: String, required: true },
      alertLevel: { 
        type: String, 
        enum: ['green', 'yellow', 'red'], 
        required: true 
      },
      message: { type: String, required: true },
      priority: { type: Number, min: 1, max: 5, required: true },
      confidence: { type: Number, min: 0, max: 1, default: 0.95 },
      timestamp: { type: Date, default: Date.now },
      data: { type: mongoose.Schema.Types.Mixed }
    }],
    totalAnomalies: { type: Number, default: 0 }
  },
  
  // ผลการตรวจจับจาก ML Models
  mlDetection: {
    anomaliesFound: { type: Boolean, default: false },
    modelUsed: { 
      type: String, 
      enum: ['isolation_forest', 'one_class_svm', 'local_outlier_factor', 
             'elliptic_envelope', 'ensemble'], 
      default: 'ensemble' 
    },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    featureCount: { type: Number, default: 49 },
    modelsAvailable: { type: Boolean, default: false },
    predictions: [{ type: mongoose.Schema.Types.Mixed }],
    batchIndex: { type: Number, default: 0 },
    error: { type: String, default: null }
  },
  
  // สรุปผลรวม
  summary: {
    ruleAnomaliesFound: { type: Boolean, default: false },
    mlAnomaliesFound: { type: Boolean, default: false },
    totalAnomalies: { type: Number, default: 0 },
    alertLevel: { 
      type: String, 
      enum: ['green', 'yellow', 'red'], 
      default: 'green' 
    },
    riskLevel: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'low' 
    },
    priorityScore: { type: Number, min: 0, max: 5, default: 0 },
    healthScore: { type: Number, min: 0, max: 100, default: 100 },
    
    // คะแนนความเชื่อมั่น
    confidenceScores: {
      ruleBased: { type: Number, min: 0, max: 1, default: 0 },
      mlBased: { type: Number, min: 0, max: 1, default: 0 },
      combined: { type: Number, min: 0, max: 1, default: 0 },
      weightedAverage: { type: Number, min: 0, max: 1, default: 0 }
    },
    
    // คำแนะนำ
    recommendations: [{
      type: { type: String, required: true },
      message: { type: String, required: true },
      action: { type: String, required: true },
      priority: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        required: true 
      },
      estimatedTime: { type: String, default: '1-2 hours' },
      severityImpact: { type: String, default: 'medium' }
    }],
    
    // Metadata การวิเคราะห์
    analysisMetadata: {
      ruleDetectionTypes: [{ type: String }],
      mlModelConfidenceAvg: { type: Number, default: 0 },
      detectionConsensus: { type: Boolean, default: false },
      featureAlignmentUsed: { type: Boolean, default: false }
    }
  },
  
  // ข้อมูล Performance
  performance: {
    responseTime: { type: Number, default: 0 }, // seconds
    dataPointsProcessed: { type: Number, default: 1 },
    cacheUsed: { type: Boolean, default: false },
    featureAlignments: { type: Number, default: 0 },
    modelsAvailable: { type: Boolean, default: false }
  },
  
  // ข้อมูล Metadata
  metadata: {
    apiVersion: { type: String, default: '2.1-fixed' },
    processingTimestamp: { type: Date, default: Date.now },
    dataHistorySize: { type: Number, default: 0 },
    expectedFeatures: { type: Number, default: 49 }
  },
  
  // Alert message ที่พร้อมแสดง
  alertMessage: {
    level: { 
      type: String, 
      enum: ['info', 'warning', 'critical', 'error'], 
      default: 'info' 
    },
    title: { type: String, required: true, default: 'System Normal' },
    message: { type: String, required: true, default: 'All sensors operating normally' },
    icon: { type: String, default: 'OK' },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    priorityScore: { type: Number, min: 0, max: 5, default: 0 },
    healthScore: { type: Number, min: 0, max: 100, default: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    totalAnomalies: { type: Number, default: 0 },
    recommendations: [{ type: mongoose.Schema.Types.Mixed }]
  },
  
  // สถานะการประมวลผล
  status: {
    type: String,
    enum: ['processing', 'completed', 'error'],
    default: 'completed'
  },
  
  // ข้อผิดพลาด (ถ้ามี)
  error: {
    type: String,
    default: null
  },
  
  // สถานะการแก้ไข
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: null,
    maxlength: 1000
  }
}, {
  timestamps: true,
  collection: 'anomalies'
});

// Indexes สำหรับ Performance
anomalySchema.index({ deviceId: 1, timestamp: -1 });
anomalySchema.index({ userId: 1, timestamp: -1 });
anomalySchema.index({ timestamp: -1 });
anomalySchema.index({ 'summary.alertLevel': 1, timestamp: -1 });
anomalySchema.index({ 'summary.riskLevel': 1, timestamp: -1 });
anomalySchema.index({ 'summary.healthScore': 1 });
anomalySchema.index({ status: 1, timestamp: -1 });
anomalySchema.index({ resolved: 1, timestamp: -1 });
anomalySchema.index({ 'summary.alertLevel': 1, resolved: 1 });

// Virtual สำหรับ formatted timestamp
anomalySchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual สำหรับ human readable time
anomalySchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} วันที่แล้ว`;
  if (hours > 0) return `${hours} ชั่วโมงที่แล้ว`;
  if (minutes > 0) return `${minutes} นาทีที่แล้ว`;
  return 'เมื่อสักครู่';
});

// Static methods สำหรับการ query ที่ซับซ้อน
anomalySchema.statics.findByDeviceAndDateRange = function(deviceId, startDate, endDate) {
  return this.find({
    deviceId: deviceId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ timestamp: -1 });
};

anomalySchema.statics.findCriticalAnomalies = function(deviceId, limit = 10) {
  return this.find({
    deviceId: deviceId,
    'summary.alertLevel': 'red'
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

anomalySchema.statics.getHealthTrend = function(deviceId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        deviceId: deviceId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        avgHealthScore: { $avg: '$summary.healthScore' },
        totalAnomalies: { $sum: '$summary.totalAnomalies' },
        criticalCount: {
          $sum: {
            $cond: [{ $eq: ['$summary.alertLevel', 'red'] }, 1, 0]
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);
};

anomalySchema.statics.getLatestByDevice = function(deviceId) {
  return this.findOne({ deviceId: deviceId })
    .sort({ timestamp: -1 })
    .populate('resolvedBy', 'email');
};

anomalySchema.statics.getDeviceStats = function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$deviceId',
        totalAnomalies: { $sum: 1 },
        criticalCount: {
          $sum: { $cond: [{ $eq: ['$summary.alertLevel', 'red'] }, 1, 0] }
        },
        avgHealthScore: { $avg: '$summary.healthScore' },
        lastAnomaly: { $max: '$timestamp' },
        resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } }
      }
    },
    {
      $sort: { totalAnomalies: -1 }
    }
  ]);
};

// Instance methods
anomalySchema.methods.isHighPriority = function() {
  return this.summary.alertLevel === 'red' || this.summary.priorityScore >= 3;
};

anomalySchema.methods.getMainRecommendation = function() {
  if (this.summary.recommendations && this.summary.recommendations.length > 0) {
    return this.summary.recommendations.find(r => r.priority === 'high') || 
           this.summary.recommendations[0];
  }
  return null;
};

anomalySchema.methods.getPrimaryAnomalyType = function() {
  if (this.ruleBasedDetection.anomalies && this.ruleBasedDetection.anomalies.length > 0) {
    // หา anomaly ที่มี priority สูงสุด
    const highest = this.ruleBasedDetection.anomalies.reduce((prev, current) => 
      (prev.priority > current.priority) ? prev : current
    );
    return highest.type;
  }
  return 'ml_detected';
};

anomalySchema.methods.toResponseFormat = function() {
  return {
    id: this._id,
    deviceId: this.deviceId,
    timestamp: this.timestamp,
    
    // ข้อมูลหลัก
    summary: {
      alertLevel: this.summary.alertLevel,
      riskLevel: this.summary.riskLevel,
      healthScore: this.summary.healthScore,
      totalAnomalies: this.summary.totalAnomalies,
      recommendations: this.summary.recommendations.slice(0, 3)
    },
    
    // Alert message
    alertMessage: this.alertMessage,
    
    // Performance info
    performance: this.performance,
    
    // Status
    status: this.status,
    resolved: this.resolved,
    resolvedAt: this.resolvedAt,
    
    // Helper properties
    isHighPriority: this.isHighPriority(),
    primaryType: this.getPrimaryAnomalyType(),
    timeAgo: this.timeAgo,
    
    // API version
    apiVersion: this.metadata.apiVersion
  };
};

// สำหรับ legacy compatibility
anomalySchema.methods.toLegacyFormat = function() {
  const primaryType = this.getPrimaryAnomalyType();
  const mainRecommendation = this.getMainRecommendation();
  
  return {
    _id: this._id,
    device_id: this.deviceId,
    device_name: this.deviceId,
    type: primaryType,
    severity: this.summary.alertLevel,
    description: this.alertMessage.message,
    timestamp: this.timestamp,
    status: this.resolved ? 'resolved' : 'unresolved',
    confidence_score: this.summary.confidenceScores.combined,
    data: this.sensorData,
    resolved_at: this.resolvedAt,
    resolved_by: this.resolvedBy,
    resolution_notes: this.notes,
    detection_method: 'hybrid',
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    
    // เพิ่มข้อมูลจาก v2.1
    health_score: this.summary.healthScore,
    risk_level: this.summary.riskLevel,
    main_recommendation: mainRecommendation,
    total_anomalies: this.summary.totalAnomalies
  };
};

// Pre-save middleware
anomalySchema.pre('save', function(next) {
  // ตรวจสอบและปรับค่า health score
  if (this.summary.healthScore < 0) this.summary.healthScore = 0;
  if (this.summary.healthScore > 100) this.summary.healthScore = 100;
  
  // ตรวจสอบความสอดคล้องของ alert level และ priority
  if (this.summary.alertLevel === 'red' && this.summary.priorityScore < 2) {
    this.summary.priorityScore = 3;
  }
  
  // สร้าง alert message หากยังไม่มีหรือเป็นค่า default
  if (!this.alertMessage.title || this.alertMessage.title === 'System Normal') {
    this.alertMessage = this.generateAlertMessage();
  }
  
  next();
});

// Method สำหรับสร้าง alert message
anomalySchema.methods.generateAlertMessage = function() {
  const summary = this.summary;
  
  if (summary.alertLevel === 'red') {
    return {
      level: 'critical',
      title: `Critical System Alert - Health Score: ${summary.healthScore}/100`,
      message: `IMMEDIATE ACTION REQUIRED! ${summary.totalAnomalies} critical anomalies detected. Risk Level: ${summary.riskLevel.toUpperCase()}`,
      icon: 'CRITICAL',
      confidence: summary.confidenceScores.combined,
      priorityScore: summary.priorityScore,
      healthScore: summary.healthScore,
      riskLevel: summary.riskLevel,
      totalAnomalies: summary.totalAnomalies,
      recommendations: summary.recommendations.slice(0, 2)
    };
  } else if (summary.alertLevel === 'yellow') {
    return {
      level: 'warning',
      title: `System Warning - Health Score: ${summary.healthScore}/100`,
      message: `Unusual patterns detected. Investigation recommended. Risk Level: ${summary.riskLevel.toUpperCase()}`,
      icon: 'WARNING',
      confidence: summary.confidenceScores.combined,
      priorityScore: summary.priorityScore,
      healthScore: summary.healthScore,
      riskLevel: summary.riskLevel,
      totalAnomalies: summary.totalAnomalies,
      recommendations: summary.recommendations.slice(0, 2)
    };
  } else {
    return {
      level: 'info',
      title: `System Normal - Health Score: ${summary.healthScore}/100`,
      message: `All sensors are operating within normal parameters. Risk Level: ${summary.riskLevel.toUpperCase()}`,
      icon: 'OK',
      confidence: summary.confidenceScores.combined || 1.0,
      priorityScore: summary.priorityScore,
      healthScore: summary.healthScore,
      riskLevel: summary.riskLevel,
      totalAnomalies: summary.totalAnomalies,
      recommendations: []
    };
  }
};

module.exports = mongoose.model('Anomaly', anomalySchema);