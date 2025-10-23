const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  body: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  type: {
    type: String,
    enum: [
      'anomaly_alert',
      'device_status', 
      'system_update',
      'zone_alert',
      'battery_low',
      'connection_lost',
      'test',
      'custom'
    ],
    default: 'custom'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal'
  },
  deviceId: {
    type: String,
    index: true
  },
  anomalyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anomaly'
  },
  zoneId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  
  expoPushTicket: {
    id: String,
    status: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  expoPushReceipt: {
    status: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  targetTokens: [{
    type: String 
  }],
  successfulDeliveries: {
    type: Number,
    default: 0
  },
  failedDeliveries: {
    type: Number,
    default: 0
  },
  
  scheduledFor: Date,
  expiresAt: Date,
  
  clicked: {
    type: Boolean,
    default: false
  },
  clickedAt: Date,
  
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  batchId: String,
  
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, deliveryStatus: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ deviceId: 1, createdAt: -1 });
notificationSchema.index({ anomalyId: 1 });
notificationSchema.index({ deliveryStatus: 1, scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.methods.markAsSent = function(ticketId, ticketData) {
  this.deliveryStatus = 'sent';
  this.sentAt = new Date();
  this.expoPushTicket = {
    id: ticketId,
    status: ticketData.status,
    message: ticketData.message,
    details: ticketData.details
  };
  return this.save();
};

notificationSchema.methods.markAsDelivered = function(receiptData) {
  this.deliveryStatus = 'delivered';
  this.deliveredAt = new Date();
  this.expoPushReceipt = {
    status: receiptData.status,
    message: receiptData.message,
    details: receiptData.details
  };
  return this.save();
};

notificationSchema.methods.markAsFailed = function(error) {
  this.deliveryStatus = 'failed';
  this.errorMessage = error;
  this.retryCount += 1;
  return this.save();
};

notificationSchema.methods.markAsRead = function() {
  this.deliveryStatus = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsClicked = function() {
  this.clicked = true;
  this.clickedAt = new Date();
  return this.save();
};

notificationSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && 
         this.deliveryStatus === 'failed' && 
         (!this.expiresAt || new Date() < this.expiresAt);
};

notificationSchema.statics.findUnreadForUser = function(userId) {
  return this.find({ 
    userId, 
    deliveryStatus: { $in: ['delivered', 'sent'] },
    readAt: { $exists: false }
  }).sort({ createdAt: -1 });
};

notificationSchema.statics.findPendingForDelivery = function() {
  return this.find({ 
    deliveryStatus: 'pending',
    $or: [
      { scheduledFor: { $lte: new Date() } },
      { scheduledFor: { $exists: false } }
    ],
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } }
    ]
  }).sort({ priority: -1, createdAt: 1 });
};

notificationSchema.statics.findFailedForRetry = function() {
  return this.find({ 
    deliveryStatus: 'failed',
    retryCount: { $lt: this.maxRetries },
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } }
    ]
  }).sort({ priority: -1, createdAt: 1 });
};

notificationSchema.statics.getStatsForUser = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ['$deliveryStatus', 'delivered'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$deliveryStatus', 'failed'] }, 1, 0] }
        },
        read: {
          $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] }
        },
        clicked: {
          $sum: { $cond: ['$clicked', 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Notification', notificationSchema);