const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === 'true' || isDevelopment;

// Conditional logging helper
const log = {
  info: (message, ...args) => {
    console.log(message, ...args);
  },
  debug: (message, ...args) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(message, ...args);
    }
  },
  error: (message, ...args) => {
    console.error(message, ...args);
  }
};

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
    this.batchSize = 100; 
    this.retryDelay = 1000; 
  }

  async registerToken(userId, expoPushToken, deviceInfo) {
  try {
    const isValidExpoToken = Expo.isExpoPushToken(expoPushToken);
    const isDevToken = expoPushToken.startsWith('ExpoToken[DEV_') ||
                      expoPushToken.startsWith('ExpoPushToken[DEV_');
    const isMockToken = expoPushToken.startsWith('ExponentPushToken[SIMULATOR_') || 
                       expoPushToken.startsWith('ExponentPushToken[FALLBACK_') ||
                       expoPushToken.startsWith('ExpoPushToken[SIMULATOR_') ||
                       expoPushToken.startsWith('ExpoPushToken[FALLBACK_');
    
    if (!isValidExpoToken && !isDevToken && !isMockToken) {
      throw new Error('Invalid Expo push token format');
    }
    
    if (isDevToken || isMockToken) {
      log.debug('Using development/mock push token - notifications will only work in development');
    }

      let existingToken = await PushToken.findOne({ expoPushToken });
      
      if (existingToken) {
        existingToken.userId = userId;
        existingToken.deviceInfo = { ...existingToken.deviceInfo, ...deviceInfo };
        existingToken.isActive = true;
        existingToken.lastUsed = new Date();
        await existingToken.save();
        log.debug(`Updated existing push token for user ${userId}`);
        return existingToken;
      }

      if (deviceInfo.deviceId) {
        await PushToken.updateMany(
          { 
            userId, 
            'deviceInfo.deviceId': deviceInfo.deviceId,
            isActive: true 
          },
          { $set: { isActive: false } }
        );
      }

      const newToken = new PushToken({
        userId,
        expoPushToken,
        deviceInfo,
        isActive: true,
        lastUsed: new Date()
      });

      await newToken.save();
      log.debug(`Registered new push token for user ${userId}`);
      return newToken;

    } catch (error) {
      log.error('Error registering push token:', error.message);
      throw error;
    }
  }

  async updatePreferences(userId, preferences) {
    try {
      const tokens = await PushToken.find({ userId, isActive: true });
      
      for (const token of tokens) {
        await token.updatePreferences(preferences);
      }
      
      log.debug(`Updated preferences for user ${userId}`);
      return { success: true, tokensUpdated: tokens.length };

    } catch (error) {
      log.error('Error updating preferences:', error.message);
      throw error;
    }
  }

  async getPreferences(userId) {
    try {
      const token = await PushToken.findOne({ userId, isActive: true });
      return token ? token.preferences : null;
    } catch (error) {
      log.error('Error getting preferences:', error.message);
      throw error;
    }
  }

  async sendToUsers(userIds, title, body, data = {}, options = {}) {
    try {
      const notifications = [];
      
      for (const userId of userIds) {
        const notification = new Notification({
          userId,
          title,
          body,
          data,
          type: options.type || 'custom',
          priority: options.priority || 'normal',
          deviceId: data.deviceId,
          anomalyId: data.anomalyId,
          zoneId: data.zoneId,
          scheduledFor: options.scheduledFor,
          expiresAt: options.expiresAt,
          isSystemGenerated: options.isSystemGenerated || false,
          batchId: options.batchId
        });

        await notification.save();
        notifications.push(notification);
      }

      this.queueNotificationsForDelivery(notifications);
      
      log.debug(`Queued ${notifications.length} notifications for delivery`);
      return { success: true, notifications };

    } catch (error) {
      log.error('Error sending notifications:', error.message);
      throw error;
    }
  }

  async sendToUser(userId, title, body, data = {}, options = {}) {
    return this.sendToUsers([userId], title, body, data, options);
  }

  async sendAnomalyAlert(anomaly) {
  try {
    const { userId, deviceId, anomalyType, alertLevel, message } = anomaly;
    
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    const deviceName = device ? device.name : 'Unknown Device';
    
    const tokens = await PushToken.findActiveTokensForUser(userId);
    if (tokens.length === 0) {
      log.debug(`No active push tokens found for user ${userId}`);
      return { success: false, reason: 'No active tokens' };
    }

    const userPrefs = tokens[0].preferences;
    if (!userPrefs.anomalyAlerts) {
      log.debug(`User ${userId} has disabled anomaly alerts`);
      return { success: false, reason: 'Anomaly alerts disabled' };
    }

    if (userPrefs.criticalOnly && alertLevel !== 'critical') {
      log.debug(`User ${userId} only wants critical alerts, but this is ${alertLevel}`);
      return { success: false, reason: 'Non-critical alert filtered' };
    }

    if (this.isQuietHours(userPrefs) && alertLevel !== 'critical') {
      log.debug(`Quiet hours active for user ${userId}, suppressing ${alertLevel} alert`);
      return { success: false, reason: 'Quiet hours active' };
    }

    const title = this.getAnomalyTitle(anomalyType, alertLevel);
    const priority = alertLevel === 'critical' ? 'critical' : 'high';
    const body = `${deviceName}: ${message}`;  

    return this.sendToUser(userId, title, body, {
      type: 'anomaly',
      anomalyId: anomaly._id,
      deviceId,
      device_name: deviceName,  
      alertLevel,
      anomalyType
    }, {
      type: 'anomaly_alert',
      priority,
      isSystemGenerated: true
    });

  } catch (error) {
    log.error('Error sending anomaly alert:', error.message);
    throw error;
  }
}

  async sendDeviceAlert(userId, deviceId, deviceName, status, message) {
    try {
      const tokens = await PushToken.findActiveTokensForUser(userId);
      if (tokens.length === 0) return { success: false, reason: 'No active tokens' };

      const userPrefs = tokens[0].preferences;
      if (!userPrefs.deviceAlerts) {
        return { success: false, reason: 'Device alerts disabled' };
      }

      const title = `Device ${status}`;
      const body = `${deviceName}: ${message}`;

      return this.sendToUser(userId, title, body, {
        type: 'device_status',
        deviceId,
        deviceName,
        status
      }, {
        type: 'device_status',
        priority: 'normal',
        isSystemGenerated: true
      });

    } catch (error) {
      log.error('Error sending device alert:', error.message);
      throw error;
    }
  }

  async sendTestNotification(userId) {
    try {
      const title = 'Test Notification';
      const body = 'This is a test notification from EMIB server';
      
      return this.sendToUser(userId, title, body, {
        type: 'test',
        timestamp: new Date().toISOString()
      }, {
        type: 'test',
        priority: 'normal'
      });

    } catch (error) {
      log.error('Error sending test notification:', error.message);
      throw error;
    }
  }

  async processDeliveryQueue() {
    try {
      const pendingNotifications = await Notification.findPendingForDelivery();
      
      if (pendingNotifications.length === 0) {
        return { processed: 0 };
      }

      log.debug(`Processing ${pendingNotifications.length} pending notifications`);

      let processed = 0;
      const batches = this.chunkArray(pendingNotifications, this.batchSize);

      for (const batch of batches) {
        await this.deliverNotificationBatch(batch);
        processed += batch.length;
      }

      return { processed };

    } catch (error) {
      log.error('Error processing delivery queue:', error.message);
      throw error;
    }
  }

async deliverNotificationBatch(notifications) {
  try {
    const messages = [];
    const notificationMap = new Map();
    
    for (const notification of notifications) {
      const tokens = await PushToken.findActiveTokensForUser(notification.userId);
      
      for (const tokenDoc of tokens) {
        if (!this.shouldSendNotification(notification, tokenDoc.preferences)) {
          continue;
        }

        const isDevelopmentToken = tokenDoc.expoPushToken.includes('DEV_') || 
                                  tokenDoc.expoPushToken.includes('SIMULATOR_') || 
                                  tokenDoc.expoPushToken.includes('FALLBACK_');

        if (isDevelopmentToken) {
          log.debug(`Skipping dev token (mock delivery): ${tokenDoc.expoPushToken.substring(0, 40)}...`);
          
          await notification.markAsSent('mock_dev_token', { 
            status: 'ok', 
            message: 'Development token - mock delivery' 
          });
          await tokenDoc.markSuccess();
          
          log.debug(`Mock sent notification ${notification._id} to dev token`);
          continue;
        }

        const message = {
          to: tokenDoc.expoPushToken,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: tokenDoc.preferences.soundEnabled ? 'default' : null,
          priority: this.getExpoPriority(notification.priority),
          channelId: this.getChannelId(notification.type, notification.priority)
        };

        messages.push(message);
        notificationMap.set(tokenDoc.expoPushToken, {
          notification,
          tokenDoc
        });
      }
    }

    if (messages.length === 0) {
      log.debug('No real push tokens to send (only dev tokens processed)');
      return;
    }

    log.debug(`Sending ${messages.length} real push notifications via Expo`);

    const chunks = this.expo.chunkPushNotifications(messages);
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        
        for (let i = 0; i < ticketChunk.length; i++) {
          const ticket = ticketChunk[i];
          const message = chunk[i];
          const { notification, tokenDoc } = notificationMap.get(message.to);

          if (ticket.status === 'ok') {
            await notification.markAsSent(ticket.id, ticket);
            await tokenDoc.markSuccess();
            log.debug(`Sent notification ${notification._id} to ${message.to.substring(0, 30)}...`);
          } else {
            await notification.markAsFailed(ticket.message || 'Unknown error');
            await tokenDoc.markFailure(ticket.message);
            log.error(`Failed to send notification ${notification._id}:`, ticket.message);
          }
        }

      } catch (error) {
        log.error('Error sending chunk:', error.message);
        
        for (const message of chunk) {
          const { notification, tokenDoc } = notificationMap.get(message.to);
          await notification.markAsFailed(error.message);
          await tokenDoc.markFailure(error.message);
        }
      }
    }

  } catch (error) {
    log.error('Error delivering notification batch:', error.message);
    throw error;
  }
}

  queueNotificationsForDelivery(notifications) {
    setTimeout(() => {
      this.processDeliveryQueue().catch(log.error);
    }, 1000);
  }

  isQuietHours(preferences) {
    if (!preferences.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const [startHour, startMin] = preferences.quietStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietEnd.split(':').map(Number);
    
    const quietStart = startHour * 100 + startMin;
    const quietEnd = endHour * 100 + endMin;

    if (quietStart < quietEnd) {
      return currentTime >= quietStart && currentTime <= quietEnd;
    } else {
      return currentTime >= quietStart || currentTime <= quietEnd;
    }
  }

  shouldSendNotification(notification, preferences) {
    if (!preferences.enabled) return false;

    switch (notification.type) {
      case 'anomaly_alert':
        if (!preferences.anomalyAlerts) return false;
        if (preferences.criticalOnly && notification.priority !== 'critical') return false;
        if (this.isQuietHours(preferences) && notification.priority !== 'critical') return false;
        break;
      
      case 'device_status':
        if (!preferences.deviceAlerts) return false;
        break;
        
      case 'system_update':
        if (!preferences.systemAlerts) return false;
        break;
    }

    return true;
  }

  getAnomalyTitle(anomalyType, alertLevel) {
    const titles = {
      'sudden_drop': 'Sudden Value Drop',
      'sudden_spike': 'Sudden Value Spike', 
      'constant_value': 'Constant Reading',
      'missing_data': 'Data Missing',
      'low_voltage': 'Low Voltage',
      'high_fluctuation': 'High Fluctuation',
      'vpd_too_low': 'VPD Too Low',
      'dew_point_close': 'Dew Point Alert',
      'battery_depleted': 'Battery Low',
      'ml_detected': 'Anomaly Detected'
    };

    const prefix = alertLevel === 'critical' ? 'CRITICAL' : 
                   alertLevel === 'red' ? 'ALERT' : 'Warning';
    
    return `${prefix} ${titles[anomalyType] || 'Anomaly Detected'}`;
  }

  getExpoPriority(priority) {
    switch (priority) {
      case 'critical': return 'high';
      case 'high': return 'high';
      case 'normal': return 'normal';
      case 'low': return 'normal';
      default: return 'normal';
    }
  }

  getChannelId(type, priority) {
    if (priority === 'critical') return 'critical';
    if (type === 'anomaly_alert') return 'anomaly';
    return 'default';
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async cleanupOldTokens(days = 30) {
    try {
      const result = await PushToken.deactivateOldTokens(days);
      log.info(`Deactivated ${result.modifiedCount} old push tokens`);
      return result;
    } catch (error) {
      log.error('Error cleaning up old tokens:', error.message);
      throw error;
    }
  }

  async cleanupOldNotifications(days = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        deliveryStatus: { $in: ['delivered', 'failed', 'read'] }
      });
      
      log.info(`Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      log.error('Error cleaning up old notifications:', error.message);
      throw error;
    }
  }

  async getDeliveryStats(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await Notification.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$deliveryStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      return stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

    } catch (error) {
      log.error('Error getting delivery stats:', error.message);
      throw error;
    }
  }
}

module.exports = new PushNotificationService();