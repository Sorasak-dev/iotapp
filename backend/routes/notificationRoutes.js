// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateToken = require('../middleware/authMiddleware');

// Middleware to validate request body for certain routes
const validateTokenRegistration = (req, res, next) => {
  const { expoPushToken, deviceInfo } = req.body;
  
  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Valid expoPushToken is required'
    });
  }

  if (deviceInfo && typeof deviceInfo !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'deviceInfo must be an object'
    });
  }

  next();
};

const validateNotificationContent = (req, res, next) => {
  const { title, body } = req.body;
  
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid title is required'
    });
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid body is required'
    });
  }

  if (title.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Title must be 100 characters or less'
    });
  }

  if (body.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Body must be 500 characters or less'
    });
  }

  next();
};

// Public health check (no auth required)
router.get('/health', notificationController.healthCheck);

// ===== USER ENDPOINTS (Require Authentication) =====

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register device for push notifications
 * @access  Private
 */
router.post('/register-token', 
  authenticateToken, 
  validateTokenRegistration, 
  notificationController.registerToken
);

/**
 * @route   PUT /api/notifications/update-token
 * @desc    Update existing push token (alias for register-token)
 * @access  Private
 */
router.put('/update-token', 
  authenticateToken, 
  validateTokenRegistration, 
  notificationController.registerToken
);

/**
 * @route   DELETE /api/notifications/remove-token
 * @desc    Remove/deactivate push token
 * @access  Private
 */
router.delete('/remove-token', 
  authenticateToken, 
  notificationController.removeToken
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get('/preferences', 
  authenticateToken, 
  notificationController.getPreferences
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put('/preferences', 
  authenticateToken, 
  notificationController.updatePreferences
);

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification to user
 * @access  Private
 */
router.post('/test', 
  authenticateToken, 
  notificationController.sendTestNotification
);

/**
 * @route   GET /api/notifications/history
 * @desc    Get user's notification history
 * @access  Private
 */
router.get('/history', 
  authenticateToken, 
  notificationController.getHistory
);

/**
 * @route   PUT /api/notifications/mark-read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put('/mark-read', 
  authenticateToken, 
  notificationController.markAsRead
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics for user
 * @access  Private
 */
router.get('/stats', 
  authenticateToken, 
  notificationController.getStats
);

/**
 * @route   GET /api/notifications/tokens
 * @desc    Get user's active push tokens (for debugging)
 * @access  Private
 */
router.get('/tokens', 
  authenticateToken, 
  notificationController.getActiveTokens
);

// ===== ADMIN/SYSTEM ENDPOINTS =====

/**
 * @route   POST /api/notifications/send-to-user
 * @desc    Send notification to specific user (Admin)
 * @access  Private (Admin)
 */
router.post('/send-to-user', 
  authenticateToken,
  validateNotificationContent,
  notificationController.sendToUser
);

/**
 * @route   POST /api/notifications/send-bulk
 * @desc    Send bulk notifications (Admin)
 * @access  Private (Admin)
 */
router.post('/send-bulk', 
  authenticateToken,
  validateNotificationContent,
  notificationController.sendBulkNotifications
);

// ===== ERROR HANDLING =====

// Handle 404 for notification routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Notification endpoint not found',
    availableEndpoints: [
      'POST /register-token - Register push token',
      'PUT /update-token - Update push token', 
      'DELETE /remove-token - Remove push token',
      'GET /preferences - Get notification preferences',
      'PUT /preferences - Update notification preferences',
      'POST /test - Send test notification',
      'GET /history - Get notification history',
      'PUT /mark-read - Mark notifications as read',
      'GET /stats - Get notification statistics',
      'GET /tokens - Get active tokens',
      'GET /health - Health check',
      'POST /send-to-user - Send to specific user (Admin)',
      'POST /send-bulk - Send bulk notifications (Admin)'
    ]
  });
});

module.exports = router;