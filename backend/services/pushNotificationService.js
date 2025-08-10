// services/pushNotificationService.js
const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
    this.batchSize = 100; // Expo recommends batches of 100
    this.retryDelay = 1000; // 1 second delay between retries
  }

  /**
   * Register a new push token for a user
   */
  async registerToken(userId, expoPushToken, deviceInfo) {
    try {
      // 🔥 แก้ไขการตรวจสอบ token format ให้รองรับ Development token
      const isValidExpoToken = Expo.isExpoPushToken(expoPushToken);
      const isDevToken = expoPushToken.startsWith('ExpoToken[DEV_');
      const isMockToken = expoPushToken.startsWith('ExponentPushToken[SIMULATOR_') || 
                         expoPushToken.startsWith('ExponentPushToken[FALLBACK_');
      
      if (!isValidExpoToken && !isDevToken && !isMockToken) {
        throw new Error('Invalid Expo push token format');
      }

      // ⚠️ Log warning สำหรับ development token
      if (isDevToken || isMockToken) {
        console.log('⚠️ Using development/mock push token - notifications will only work in development');
      }

      // Check if token already exists
      let existingToken = await PushToken.findOne({ expoPushToken });
      
      if (existingToken) {
        // Update existing token with new user/device info
        existingToken.userId = userId;
        existingToken.deviceInfo = { ...existingToken.deviceInfo, ...deviceInfo };
        existingToken.isActive = true;
        existingToken.lastUsed = new Date();
        await existingToken.save();
        console.log(`✅ Updated existing push token for user ${userId}`);
        return existingToken;
      }

      // Deactivate old tokens for the same device
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

      // Create new token
      const newToken = new PushToken({
        userId,
        expoPushToken,
        deviceInfo,
        isActive: true,
        lastUsed: new Date()
      });

      await newToken.save();
      console.log(`✅ Registered new push token for user ${userId}`);
      return newToken;

    } catch (error) {
      console.error('❌ Error registering push token:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId, preferences) {
    try {
      const tokens = await PushToken.find({ userId, isActive: true });
      
      for (const token of tokens) {
        await token.updatePreferences(preferences);
      }
      
      console.log(`✅ Updated preferences for user ${userId}`);
      return { success: true, tokensUpdated: tokens.length };

    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId) {
    try {
      const token = await PushToken.findOne({ userId, isActive: true });
      return token ? token.preferences : null;
    } catch (error) {
      console.error('❌ Error getting preferences:', error);
      throw error;
    }
  }

  /**
   * Send push notification to specific users
   */
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

      // Queue for delivery
      this.queueNotificationsForDelivery(notifications);
      
      console.log(`✅ Queued ${notifications.length} notifications for delivery`);
      return { success: true, notifications };

    } catch (error) {
      console.error('❌ Error sending notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to a single user
   */
  async sendToUser(userId, title, body, data = {}, options = {}) {
    return this.sendToUsers([userId], title, body, data, options);
  }

  /**
   * Send anomaly alert notifications
   */
  async sendAnomalyAlert(anomaly) {
    try {
      const { userId, deviceId, anomalyType, alertLevel, message } = anomaly;
      
      // Get user's notification preferences
      const tokens = await PushToken.findActiveTokensForUser(userId);
      if (tokens.length === 0) {
        console.log(`⚠️ No active push tokens found for user ${userId}`);
        return { success: false, reason: 'No active tokens' };
      }

      // Check if user wants anomaly alerts
      const userPrefs = tokens[0].preferences;
      if (!userPrefs.anomalyAlerts) {
        console.log(`⚠️ User ${userId} has disabled anomaly alerts`);
        return { success: false, reason: 'Anomaly alerts disabled' };
      }

      // Check if only critical alerts are enabled
      if (userPrefs.criticalOnly && alertLevel !== 'critical') {
        console.log(`⚠️ User ${userId} only wants critical alerts, but this is ${alertLevel}`);
        return { success: false, reason: 'Non-critical alert filtered' };
      }

      // Check quiet hours
      if (this.isQuietHours(userPrefs) && alertLevel !== 'critical') {
        console.log(`⚠️ Quiet hours active for user ${userId}, suppressing ${alertLevel} alert`);
        return { success: false, reason: 'Quiet hours active' };
      }

      const title = this.getAnomalyTitle(anomalyType, alertLevel);
      const priority = alertLevel === 'critical' ? 'critical' : 'high';

      return this.sendToUser(userId, title, message, {
        type: 'anomaly',
        anomalyId: anomaly._id,
        deviceId,
        alertLevel,
        anomalyType
      }, {
        type: 'anomaly_alert',
        priority,
        isSystemGenerated: true
      });

    } catch (error) {
      console.error('❌ Error sending anomaly alert:', error);
      throw error;
    }
  }

  /**
   * Send device status notifications
   */
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
      console.error('❌ Error sending device alert:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
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
      console.error('❌ Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Process notification delivery queue
   */
  async processDeliveryQueue() {
    try {
      // Get pending notifications
      const pendingNotifications = await Notification.findPendingForDelivery();
      
      if (pendingNotifications.length === 0) {
        return { processed: 0 };
      }

      console.log(`📤 Processing ${pendingNotifications.length} pending notifications`);

      let processed = 0;
      const batches = this.chunkArray(pendingNotifications, this.batchSize);

      for (const batch of batches) {
        await this.deliverNotificationBatch(batch);
        processed += batch.length;
      }

      return { processed };

    } catch (error) {
      console.error('❌ Error processing delivery queue:', error);
      throw error;
    }
  }

  /**
 * Deliver a batch of notifications
 */
async deliverNotificationBatch(notifications) {
  try {
    const messages = [];
    const notificationMap = new Map();

    // Prepare messages for each notification
    for (const notification of notifications) {
      const tokens = await PushToken.findActiveTokensForUser(notification.userId);
      
      for (const tokenDoc of tokens) {
        // Check user preferences
        if (!this.shouldSendNotification(notification, tokenDoc.preferences)) {
          continue;
        }

        // 🔥 Skip sending to development/mock tokens แทนที่จะส่งไป Expo
        const isDevelopmentToken = tokenDoc.expoPushToken.includes('DEV_') || 
                                  tokenDoc.expoPushToken.includes('SIMULATOR_') || 
                                  tokenDoc.expoPushToken.includes('FALLBACK_');

        if (isDevelopmentToken) {
          console.log(`⚠️ Skipping dev token (mock delivery): ${tokenDoc.expoPushToken.substring(0, 40)}...`);
          
          // Mark as successfully sent for development tokens (mock success)
          await notification.markAsSent('mock_dev_token', { 
            status: 'ok', 
            message: 'Development token - mock delivery' 
          });
          await tokenDoc.markSuccess();
          
          console.log(`✅ Mock sent notification ${notification._id} to dev token`);
          continue;
        }

        // เฉพาะ production tokens เท่านั้นที่จะส่งไป Expo จริงๆ
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
      console.log('⚠️ No real push tokens to send (only dev tokens processed)');
      return;
    }

    console.log(`📤 Sending ${messages.length} real push notifications via Expo`);

    // Send via Expo (เฉพาะ real tokens)
    const chunks = this.expo.chunkPushNotifications(messages);
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        
        // Process tickets
        for (let i = 0; i < ticketChunk.length; i++) {
          const ticket = ticketChunk[i];
          const message = chunk[i];
          const { notification, tokenDoc } = notificationMap.get(message.to);

          if (ticket.status === 'ok') {
            await notification.markAsSent(ticket.id, ticket);
            await tokenDoc.markSuccess();
            console.log(`✅ Sent notification ${notification._id} to ${message.to.substring(0, 30)}...`);
          } else {
            await notification.markAsFailed(ticket.message || 'Unknown error');
            await tokenDoc.markFailure(ticket.message);
            console.error(`❌ Failed to send notification ${notification._id}:`, ticket.message);
          }
        }

      } catch (error) {
        console.error('❌ Error sending chunk:', error);
        
        // Mark all notifications in this chunk as failed
        for (const message of chunk) {
          const { notification, tokenDoc } = notificationMap.get(message.to);
          await notification.markAsFailed(error.message);
          await tokenDoc.markFailure(error.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error delivering notification batch:', error);
    throw error;
  }
}

  /**
   * Queue notifications for delivery (async processing)
   */
  queueNotificationsForDelivery(notifications) {
    // In a real application, you might use a job queue like Bull or Agenda
    // For now, we'll process immediately with a small delay
    setTimeout(() => {
      this.processDeliveryQueue().catch(console.error);
    }, 1000);
  }

  /**
   * Helper methods
   */
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
      // Quiet hours span midnight
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

    const prefix = alertLevel === 'critical' ? '🚨 CRITICAL' : 
                   alertLevel === 'red' ? '⚠️ ALERT' : '⚠️';
    
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

  /**
   * Cleanup methods
   */
  async cleanupOldTokens(days = 30) {
    try {
      const result = await PushToken.deactivateOldTokens(days);
      console.log(`🧹 Deactivated ${result.modifiedCount} old push tokens`);
      return result;
    } catch (error) {
      console.error('❌ Error cleaning up old tokens:', error);
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
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      console.error('❌ Error cleaning up old notifications:', error);
      throw error;
    }
  }

  /**
   * Get delivery statistics
   */
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
      console.error('❌ Error getting delivery stats:', error);
      throw error;
    }
  }
}

module.exports = new PushNotificationService();