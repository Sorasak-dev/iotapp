// controllers/notificationController.js
const pushNotificationService = require('../services/pushNotificationService');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Register device push token
 */
exports.registerToken = async (req, res) => {
  try {
    const { userId, expoPushToken, deviceInfo } = req.body;
    const authenticatedUserId = req.user.id;

    // Ensure user can only register tokens for themselves
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot register token for another user'
      });
    }

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'Expo push token is required'
      });
    }

    const token = await pushNotificationService.registerToken(
      authenticatedUserId,
      expoPushToken,
      deviceInfo || {}
    );

    res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
      data: {
        tokenId: token._id,
        isActive: token.isActive,
        deviceInfo: token.deviceInfo
      }
    });

  } catch (error) {
    console.error('❌ Error registering push token:', error);
    
    if (error.message.includes('Invalid Expo push token')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid push token format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register push token',
      error: error.message
    });
  }
};

/**
 * Update notification preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    // Validate preferences
    const allowedPreferences = [
      'enabled', 'anomalyAlerts', 'criticalOnly', 'deviceAlerts', 
      'systemAlerts', 'soundEnabled', 'vibrationEnabled', 
      'quietHoursEnabled', 'quietStart', 'quietEnd'
    ];

    const filteredPreferences = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (allowedPreferences.includes(key)) {
        filteredPreferences[key] = value;
      }
    }

    const result = await pushNotificationService.updatePreferences(
      userId,
      filteredPreferences
    );

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
};

/**
 * Get notification preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await pushNotificationService.getPreferences(userId);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'No notification preferences found'
      });
    }

    res.status(200).json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('❌ Error getting preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get preferences',
      error: error.message
    });
  }
};

/**
 * Send test notification
 */
exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pushNotificationService.sendTestNotification(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        reason: result.reason
      });
    }

    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
};

/**
 * Get notification history for user
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type,
      deliveryStatus,
      startDate,
      endDate,
      unreadOnly
    } = req.query;

    // Build filter
    const filter = { userId };

    if (type) filter.type = type;
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;
    if (unreadOnly === 'true') {
      filter.readAt = { $exists: false };
      filter.deliveryStatus = { $in: ['delivered', 'sent'] };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    // Pagination
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);

    const notifications = await Notification.find(filter)
      .select('-expoPushTicket -expoPushReceipt -targetTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('anomalyId', 'anomalyType alertLevel message')
      .lean();

    const total = await Notification.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification history',
      error: error.message
    });
  }
};

/**
 * Mark notifications as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        message: 'notificationIds array is required'
      });
    }

    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        userId,
        readAt: { $exists: false }
      },
      {
        $set: {
          readAt: new Date(),
          deliveryStatus: 'read'
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
      data: {
        updatedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('❌ Error marking notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error.message
    });
  }
};

/**
 * Send notification to specific user (Admin only)
 */
exports.sendToUser = async (req, res) => {
  try {
    const { targetUserId, title, body, data, options } = req.body;
    const senderUserId = req.user.id;

    if (!targetUserId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId, title, and body are required'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    const result = await pushNotificationService.sendToUser(
      targetUserId,
      title,
      body,
      data || {},
      {
        ...options,
        isSystemGenerated: false
      }
    );

    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error sending notification to user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
};

/**
 * Send bulk notifications (Admin only)
 */
exports.sendBulkNotifications = async (req, res) => {
  try {
    const { userIds, title, body, data, options } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'userIds array, title, and body are required'
      });
    }

    if (userIds.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 1000 users per bulk send'
      });
    }

    const result = await pushNotificationService.sendToUsers(
      userIds,
      title,
      body,
      data || {},
      {
        ...options,
        isSystemGenerated: false,
        batchId: `bulk_${Date.now()}`
      }
    );

    res.status(200).json({
      success: true,
      message: 'Bulk notifications sent successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error sending bulk notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk notifications',
      error: error.message
    });
  }
};

/**
 * Remove/deactivate push token
 */
exports.removeToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'expoPushToken is required'
      });
    }

    const result = await PushToken.updateOne(
      { userId, expoPushToken },
      { $set: { isActive: false } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Push token not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Push token removed successfully'
    });

  } catch (error) {
    console.error('❌ Error removing push token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove push token',
      error: error.message
    });
  }
};

/**
 * Get notification statistics
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const userStats = await Notification.getStatsForUser(userId, parseInt(days));
    const deliveryStats = await pushNotificationService.getDeliveryStats(parseInt(days));

    res.status(200).json({
      success: true,
      data: {
        userStats,
        deliveryStats,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('❌ Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
      error: error.message
    });
  }
};

/**
 * Get user's active push tokens (for debugging)
 */
exports.getActiveTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const tokens = await PushToken.find({ userId, isActive: true })
      .select('-expoPushToken') // Don't expose actual tokens
      .sort({ lastUsed: -1 });

    res.status(200).json({
      success: true,
      data: {
        tokens: tokens.map(token => ({
          id: token._id,
          deviceInfo: token.deviceInfo,
          preferences: token.preferences,
          lastUsed: token.lastUsed,
          createdAt: token.createdAt
        })),
        count: tokens.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting active tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active tokens',
      error: error.message
    });
  }
};

/**
 * Health check endpoint
 */
exports.healthCheck = async (req, res) => {
  try {
    const deliveryStats = await pushNotificationService.getDeliveryStats(1);
    const activeTokensCount = await PushToken.countDocuments({ isActive: true });
    const pendingNotifications = await Notification.countDocuments({ 
      deliveryStatus: 'pending' 
    });

    res.status(200).json({
      success: true,
      message: 'Push notification service is healthy',
      data: {
        activeTokens: activeTokensCount,
        pendingNotifications,
        last24Hours: deliveryStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in health check:', error);
    res.status(500).json({
      success: false,
      message: 'Push notification service is unhealthy',
      error: error.message
    });
  }
};