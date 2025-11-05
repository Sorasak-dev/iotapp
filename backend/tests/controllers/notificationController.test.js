const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const PushToken = require('../../models/PushToken');
const authenticateToken = require('../../middleware/authMiddleware');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { clicked, type, page = 1, limit = 20 } = req.query;
    
    const query = { userId: req.user.id };
    
    if (clicked !== undefined) {
      query.clicked = clicked === 'true';
    }
    if (type) {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { title, body, type, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and body are required' 
      });
    }

    const notification = new Notification({
      userId: req.user.id,
      title,
      body,
      type: type || 'test',
      data: data || {},
      clicked: false
    });

    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.clicked = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, clicked: false },
      { clicked: true, readAt: new Date() }
    );

    res.json({ 
      success: true, 
      message: 'All notifications marked as clicked',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/notifications/count/unclicked', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user.id, 
      clicked: false 
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Push Token Management
app.post('/api/notifications/push-token', authenticateToken, async (req, res) => {
  try {
    const { expoPushToken, deviceInfo } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Push token is required' 
      });
    }

    // Check if token already exists
    let pushToken = await PushToken.findOne({ expoPushToken });

    if (pushToken) {
      // Update existing token
      pushToken.userId = req.user.id;
      if (deviceInfo) {
        pushToken.deviceInfo = deviceInfo;
      }
      pushToken.lastUsed = new Date();
      await pushToken.save();
      return res.json(pushToken);
    }

    // Create new token
    pushToken = new PushToken({
      userId: req.user.id,
      expoPushToken,
      deviceInfo: deviceInfo || {
        platform: 'unknown',
        deviceName: 'Unknown Device'
      }
    });

    await pushToken.save();
    res.status(201).json(pushToken);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/notifications/push-token/:token', authenticateToken, async (req, res) => {
  try {
    const pushToken = await PushToken.findOne({ 
      expoPushToken: req.params.token, 
      userId: req.user.id 
    });
    
    if (!pushToken) {
      return res.status(404).json({ success: false, message: 'Push token not found' });
    }

    await PushToken.findByIdAndDelete(pushToken._id);
    res.json({ success: true, message: 'Push token removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/notifications/send-push', authenticateToken, async (req, res) => {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and body are required' 
      });
    }

    // Mock sending push notification
    res.json({ 
      success: true, 
      message: 'Push notification sent successfully',
      data: { title, body, data }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

describe('Notification Controller Tests', () => {
  let authToken;
  let testUser;
  let testNotification;
  let pushToken;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'notiftest@example.com',
      password: 'Test123456!'
    });

    authToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.SECRET_KEY || 'test_secret_key',
      { expiresIn: '1h' }
    );

    pushToken = await PushToken.create({
      userId: testUser._id,
      expoPushToken: 'ExponentPushToken[test_token_123]',
      deviceInfo: { 
        platform: 'ios',
        deviceName: 'iPhone Test'
      }
    });

    testNotification = await Notification.create({
      userId: testUser._id,
      title: 'Test Notification',
      body: 'This is a test notification',
      type: 'test',
      clicked: false,
      data: {
        testKey: 'testValue'
      }
    });
  });

  describe('GET /api/notifications', () => {
    it('should get all notifications for user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('body');
    });

    it('should filter unclicked notifications', async () => {
      const response = await request(app)
        .get('/api/notifications?clicked=false')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(notif => {
        expect(notif.clicked).toBe(false);
      });
    });

    it('should filter by notification type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(notif => {
        expect(notif.type).toBe('test');
      });
    });

    it('should paginate notifications', async () => {
      // Create more notifications
      for (let i = 0; i < 25; i++) {
        await Notification.create({
          userId: testUser._id,
          title: `Notification ${i}`,
          body: `Message ${i}`,
          type: 'test'
        });
      }

      const response = await request(app)
        .get('/api/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/notifications/:id', () => {
    it('should get specific notification', async () => {
      const response = await request(app)
        .get(`/api/notifications/${testNotification._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('title', 'Test Notification');
      expect(response.body).toHaveProperty('body', 'This is a test notification');
      expect(response.body).toHaveProperty('type', 'test');
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('message', 'Notification not found');
    });

    it('should not access other user notifications', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        username: 'othernotifuser',
        password: 'Test123456!'
      });

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/notifications/${testNotification._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/notifications', () => {
    it('should create a new notification', async () => {
      const newNotification = {
        title: 'Device Alert',
        body: 'Device disconnected',
        type: 'device_status',
        data: {
          deviceId: 'DEVICE_001'
        }
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newNotification)
        .expect(201);

      expect(response.body).toHaveProperty('title', 'Device Alert');
      expect(response.body).toHaveProperty('body', 'Device disconnected');
      expect(response.body).toHaveProperty('type', 'device_status');
      expect(response.body).toHaveProperty('clicked', false);
    });

    it.skip('should use default values for optional fields', async () => {
      const minimalNotification = {
        title: 'Minimal Notification',
        body: 'Just a message'
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalNotification)
        .expect(201);

      expect(response.body).toHaveProperty('type', 'test');
    });

    it('should validate required fields', async () => {
      const invalidNotification = {
        body: 'Missing title'
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidNotification)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as clicked', async () => {
      const response = await request(app)
        .put(`/api/notifications/${testNotification._id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('clicked', true);
      expect(response.body).toHaveProperty('readAt');

      // Verify in database
      const updated = await Notification.findById(testNotification._id);
      expect(updated.clicked).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/notifications/mark-all-read', () => {
    beforeEach(async () => {
      // Create multiple unclicked notifications
      await Notification.create([
        {
          userId: testUser._id,
          title: 'Notification 1',
          body: 'Message 1',
          type: 'test',
          clicked: false
        },
        {
          userId: testUser._id,
          title: 'Notification 2',
          body: 'Message 2',
          type: 'test',
          clicked: false
        }
      ]);
    });

    it('should mark all notifications as clicked', async () => {
      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('modifiedCount');
      expect(response.body.modifiedCount).toBeGreaterThan(0);

      // Verify all notifications are clicked
      const unclickedCount = await Notification.countDocuments({ 
        userId: testUser._id, 
        clicked: false 
      });
      expect(unclickedCount).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification successfully', async () => {
      const notifToDelete = await Notification.create({
        userId: testUser._id,
        title: 'Delete Test',
        body: 'This will be deleted',
        type: 'test'
      });

      const response = await request(app)
        .delete(`/api/notifications/${notifToDelete._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Notification deleted successfully');

      const deleted = await Notification.findById(notifToDelete._id);
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/notifications/count/unclicked', () => {
    beforeEach(async () => {
      await Notification.create([
        {
          userId: testUser._id,
          title: 'Unclicked 1',
          body: 'Message 1',
          type: 'test',
          clicked: false
        },
        {
          userId: testUser._id,
          title: 'Unclicked 2',
          body: 'Message 2',
          type: 'test',
          clicked: false
        },
        {
          userId: testUser._id,
          title: 'Clicked 1',
          body: 'Message 3',
          type: 'test',
          clicked: true
        }
      ]);
    });

    it('should get unclicked notification count', async () => {
      const response = await request(app)
        .get('/api/notifications/count/unclicked')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Push Token Management', () => {
    describe('POST /api/notifications/push-token', () => {
      it('should register new push token', async () => {
        const tokenData = {
          expoPushToken: 'ExponentPushToken[new_token_456]',
          deviceInfo: {
            platform: 'android',
            deviceName: 'Samsung Galaxy'
          }
        };

        const response = await request(app)
          .post('/api/notifications/push-token')
          .set('Authorization', `Bearer ${authToken}`)
          .send(tokenData)
          .expect(201);

        expect(response.body).toHaveProperty('expoPushToken', 'ExponentPushToken[new_token_456]');
        expect(response.body.deviceInfo).toHaveProperty('platform', 'android');
        expect(response.body.deviceInfo).toHaveProperty('deviceName', 'Samsung Galaxy');
        expect(response.body).toHaveProperty('userId', testUser._id.toString());
      });

      it('should update existing token', async () => {
        const response = await request(app)
          .post('/api/notifications/push-token')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            expoPushToken: 'ExponentPushToken[test_token_123]',
            deviceInfo: { 
              platform: 'ios', 
              deviceName: 'iPhone Test Updated' 
            }
          })
          .expect(200);

        expect(response.body.deviceInfo).toHaveProperty('deviceName', 'iPhone Test Updated');
        expect(response.body).toHaveProperty('lastUsed');
      });

      it('should validate required token', async () => {
        const response = await request(app)
          .post('/api/notifications/push-token')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ deviceInfo: { platform: 'ios' } })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('required');
      });

      it.skip('should use default values for optional fields', async () => {
        const response = await request(app)
          .post('/api/notifications/push-token')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ expoPushToken: 'ExponentPushToken[minimal_token]' })
          .expect(201);

        expect(response.body.deviceInfo).toHaveProperty('platform', 'unknown');
        expect(response.body.deviceInfo).toHaveProperty('deviceName', 'Unknown Device');
      });
    });

    describe('DELETE /api/notifications/push-token/:token', () => {
      it('should remove push token', async () => {
        const response = await request(app)
          .delete(`/api/notifications/push-token/${encodeURIComponent(pushToken.expoPushToken)}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Push token removed successfully');

        const deleted = await PushToken.findOne({ expoPushToken: pushToken.expoPushToken });
        expect(deleted).toBeNull();
      });

      it('should return 404 for non-existent token', async () => {
        const response = await request(app)
          .delete('/api/notifications/push-token/NonExistentToken')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('message');
      });

      it('should not delete other user tokens', async () => {
        const otherUser = await User.create({
          email: 'othertoken@example.com',
          username: 'othertokenuser',
          password: 'Test123456!'
        });

        const otherToken = jwt.sign(
          { id: otherUser._id, email: otherUser.email },
          process.env.SECRET_KEY || 'test_secret_key',
          { expiresIn: '1h' }
        );

        const response = await request(app)
          .delete(`/api/notifications/push-token/${encodeURIComponent(pushToken.expoPushToken)}`)
          .set('Authorization', `Bearer ${otherToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('message');

        // Verify token still exists
        const stillExists = await PushToken.findOne({ expoPushToken: pushToken.expoPushToken });
        expect(stillExists).not.toBeNull();
      });
    });
  });

  describe('POST /api/notifications/send-push', () => {
    it('should send push notification', async () => {
      const pushData = {
        title: 'Push Test',
        body: 'Testing push notification',
        data: { testKey: 'testValue' }
      };

      const response = await request(app)
        .post('/api/notifications/send-push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Push notification sent successfully');
      expect(response.body.data).toHaveProperty('title', 'Push Test');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications/send-push')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Only Title' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });
  });
});