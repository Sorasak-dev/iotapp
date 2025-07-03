const mongoose = require('mongoose');

const anomalySchema = new mongoose.Schema({
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
    index: true
  },
  anomalyType: {
    type: String,
    enum: [
      'sudden_drop', 'sudden_spike', 'constant_value', 'missing_data',
      'low_voltage', 'high_fluctuation', 'vpd_too_low', 'dew_point_close',
      'battery_depleted', 'ml_detected'
    ],
    required: true
  },
  alertLevel: {
    type: String,
    enum: ['red', 'yellow', 'green'],
    default: 'yellow'
  },
  message: {
    type: String,
    required: true
  },
  detectionMethod: {
    type: String,
    enum: ['rule_based', 'ml_based', 'hybrid'],
    default: 'hybrid'
  },
  sensorData: {
    temperature: Number,
    humidity: Number,
    co2: Number,
    ec: Number,
    ph: Number,
    dew_point: Number,
    vpd: Number,
    voltage: Number,
    battery_level: Number
  },
  mlResults: {
    confidence: Number,
    model_used: String
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

anomalySchema.index({ deviceId: 1, timestamp: -1 });
anomalySchema.index({ userId: 1, resolved: 1 });
anomalySchema.index({ alertLevel: 1, resolved: 1 });
anomalySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Anomaly', anomalySchema);