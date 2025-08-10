// models/PushToken.js
const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expoPushToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true
    },
    deviceName: String,
    osVersion: String,
    appVersion: String,
    deviceId: String // unique device identifier
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  preferences: {
    enabled: { type: Boolean, default: true },
    anomalyAlerts: { type: Boolean, default: true },
    criticalOnly: { type: Boolean, default: false },
    deviceAlerts: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    vibrationEnabled: { type: Boolean, default: true },
    quietHoursEnabled: { type: Boolean, default: false },
    quietStart: { type: String, default: '22:00' },
    quietEnd: { type: String, default: '07:00' }
  },
  failureCount: {
    type: Number,
    default: 0
  },
  lastFailure: Date,
  lastSuccess: Date
}, {
  timestamps: true
});

// Index for efficient queries
pushTokenSchema.index({ userId: 1, isActive: 1 });
pushTokenSchema.index({ expoPushToken: 1, isActive: 1 });
pushTokenSchema.index({ 'deviceInfo.platform': 1 });
pushTokenSchema.index({ createdAt: -1 });

// Methods
pushTokenSchema.methods.markAsUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

pushTokenSchema.methods.markSuccess = function() {
  this.lastSuccess = new Date();
  this.failureCount = 0;
  this.isActive = true;
  return this.save();
};

pushTokenSchema.methods.markFailure = function(error) {
  this.lastFailure = new Date();
  this.failureCount += 1;
  
  // Deactivate token after 5 consecutive failures
  if (this.failureCount >= 5) {
    this.isActive = false;
  }
  
  return this.save();
};

pushTokenSchema.methods.updatePreferences = function(newPreferences) {
  this.preferences = { ...this.preferences, ...newPreferences };
  return this.save();
};

// Static methods
pushTokenSchema.statics.findActiveTokensForUser = function(userId) {
  return this.find({ 
    userId, 
    isActive: true,
    'preferences.enabled': true
  });
};

pushTokenSchema.statics.findActiveTokensForUsers = function(userIds) {
  return this.find({ 
    userId: { $in: userIds }, 
    isActive: true,
    'preferences.enabled': true
  });
};

pushTokenSchema.statics.deactivateOldTokens = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.updateMany(
    { lastUsed: { $lt: cutoffDate } },
    { $set: { isActive: false } }
  );
};

module.exports = mongoose.model('PushToken', pushTokenSchema);