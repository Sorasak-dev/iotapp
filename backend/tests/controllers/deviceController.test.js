const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Device = require('../../models/Device');
const User = require('../../models/User');
const authenticateToken = require('../../middleware/authMiddleware');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.id });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    
    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/devices', authenticateToken, async (req, res) => {
  try {
    const { deviceId, name, type, image, location, zoneId } = req.body;

    // Check for duplicate deviceId
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ 
        success: false, 
        message: 'Device with this ID already exists' 
      });
    }

    const device = new Device({
      userId: req.user.id,
      deviceId,
      name,
      type,
      image: image || 'default-icon.png',
      location,
      zoneId: zoneId || null,
      status: 'Connected'
    });

    await device.save();
    res.status(201).json(device);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // Don't allow updating deviceId
    if (req.body.deviceId && req.body.deviceId !== device.deviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update device ID' 
      });
    }

    const { name, type, image, location, status, zoneId } = req.body;
    
    if (name !== undefined) device.name = name;
    if (type !== undefined) device.type = type;
    if (image !== undefined) device.image = image;
    if (location !== undefined) device.location = location;
    if (status !== undefined) device.status = status;
    if (zoneId !== undefined) device.zoneId = zoneId;

    await device.save();
    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    await Device.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

describe('Device Controller Tests', () => {
  let authToken;
  let testUser;
  let testDevice;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'devicetest@example.com',
      password: 'Test123456!'
    });

    authToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.SECRET_KEY || 'test_secret_key',
      { expiresIn: '1h' }
    );

    testDevice = await Device.create({
      userId: testUser._id,
      deviceId: 'TEST_DEVICE_001',
      name: 'Test Temperature Sensor',
      type: 'temperature',
      image: 'sensor-icon.png',
      status: 'Connected'
    });
  });

  describe('GET /api/devices', () => {
    it('should get all devices for authenticated user', async () => {
      const response = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('deviceId');
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/devices')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return empty array for user with no devices', async () => {
      const newUser = await User.create({
        email: 'nodevices@example.com',
        username: 'nodevicesuser',
        password: 'Test123456!'
      });

      const newToken = jwt.sign(
        { id: newUser._id, email: newUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/devices/:id', () => {
    it('should get device by id', async () => {
      const response = await request(app)
        .get(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('deviceId', 'TEST_DEVICE_001');
      expect(response.body).toHaveProperty('name', 'Test Temperature Sensor');
      expect(response.body).toHaveProperty('status', 'Connected');
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/devices/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('message', 'Device not found');
    });

    it('should not allow access to other user devices', async () => {
      const otherUser = await User.create({
        email: 'otheruser@example.com',
      username: 'otheruser',
        password: 'Test123456!'
      });

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/devices', () => {
    it('should create a new device', async () => {
      const newDevice = {
        deviceId: 'TEST_DEVICE_002',
        name: 'Test Humidity Sensor',
        type: 'humidity',
        image: 'humidity-icon.png',
        location: {
          address: 'Living Room'
        }
      };

      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newDevice)
        .expect(201);

      expect(response.body).toHaveProperty('deviceId', 'TEST_DEVICE_002');
      expect(response.body).toHaveProperty('name', 'Test Humidity Sensor');
      expect(response.body).toHaveProperty('userId', testUser._id.toString());
      expect(response.body).toHaveProperty('status', 'Connected');
    });

    it('should not create device with duplicate deviceId', async () => {
      const duplicateDevice = {
        deviceId: 'TEST_DEVICE_001', // Already exists
        name: 'Duplicate Device',
        type: 'temperature',
        image: 'icon.png'
      };

      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateDevice)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const invalidDevice = {
        name: 'Invalid Device'
        // missing deviceId and type
      };

      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDevice)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should use default image if not provided', async () => {
      const deviceWithoutImage = {
        deviceId: 'TEST_DEVICE_003',
        name: 'Device Without Image',
        type: 'temperature'
      };

      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deviceWithoutImage)
        .expect(201);

      expect(response.body).toHaveProperty('image', 'default-icon.png');
    });
  });

  describe('PUT /api/devices/:id', () => {
    it('should update device successfully', async () => {
      const updateData = {
        name: 'Updated Sensor Name',
        status: 'Disconnected',
        location: {
          address: 'Bedroom'
        }
      };

      const response = await request(app)
        .put(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Updated Sensor Name');
      expect(response.body).toHaveProperty('status', 'Disconnected');
      expect(response.body.location).toHaveProperty('address', 'Bedroom');
    });

    it('should not allow updating deviceId', async () => {
      const response = await request(app)
        .put(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deviceId: 'NEW_ID' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cannot update device ID');
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/devices/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should update only specified fields', async () => {
      const response = await request(app)
        .put(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Only Name Updated' })
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Only Name Updated');
      expect(response.body.deviceId).toBe('TEST_DEVICE_001');
      expect(response.body.type).toBe('temperature');
    });
  });

  describe('DELETE /api/devices/:id', () => {
    it('should delete device successfully', async () => {
      const deviceToDelete = await Device.create({
        userId: testUser._id,
        deviceId: 'DELETE_ME',
        name: 'Device to Delete',
        type: 'temperature',
        image: 'icon.png'
      });

      const response = await request(app)
        .delete(`/api/devices/${deviceToDelete._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Device deleted successfully');

      const deletedDevice = await Device.findById(deviceToDelete._id);
      expect(deletedDevice).toBeNull();
    });

    it('should return 404 when deleting non-existent device', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/devices/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should not delete other user devices', async () => {
      const otherUser = await User.create({
        email: 'otherdelete@example.com',
      username: 'otherdeleteuser',
        password: 'Test123456!'
      });

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');

      // Verify device still exists
      const device = await Device.findById(testDevice._id);
      expect(device).not.toBeNull();
    });
  });
});