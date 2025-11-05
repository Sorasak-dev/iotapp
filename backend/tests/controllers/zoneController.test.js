const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Device = require('../../models/Device');
const authenticateToken = require('../../middleware/authMiddleware');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.get('/api/zones', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json(user.zones);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/zones/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const zone = user.zones.id(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    res.json(zone);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/zones', authenticateToken, async (req, res) => {
  try {
    const { name, location, image } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Zone name is required' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for duplicate zone name
    const existingZone = user.zones.find(z => z.name === name);
    if (existingZone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Zone with this name already exists' 
      });
    }

    const newZone = {
      name,
      location: location || {},
      image: image || null,
      isDefault: false
    };

    user.zones.push(newZone);
    await user.save();

    const createdZone = user.zones[user.zones.length - 1];
    res.status(201).json(createdZone);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/zones/:id', authenticateToken, async (req, res) => {
  try {
    const { name, location, image } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const zone = user.zones.id(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    if (name !== undefined) zone.name = name;
    if (location !== undefined) zone.location = location;
    if (image !== undefined) zone.image = image;

    await user.save();
    res.json(zone);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/zones/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const zone = user.zones.id(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    // Check if zone has devices
    const devicesInZone = await Device.countDocuments({ 
      userId: req.user.id, 
      zoneId: req.params.id 
    });

    if (devicesInZone > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete zone with assigned devices' 
      });
    }

    user.zones.pull(zone._id);
    await user.save();

    res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/zones/:id/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ 
      userId: req.user.id, 
      zoneId: req.params.id 
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/zones/:id/assign-device', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Device ID is required' 
      });
    }

    const device = await Device.findOne({ 
      _id: deviceId, 
      userId: req.user.id 
    });

    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found' 
      });
    }

    device.zoneId = req.params.id;
    await device.save();

    res.json({ 
      success: true, 
      message: 'Device assigned to zone successfully',
      device 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/zones/:id/remove-device', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Device ID is required' 
      });
    }

    const device = await Device.findOne({ 
      _id: deviceId, 
      userId: req.user.id,
      zoneId: req.params.id 
    });

    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found in this zone' 
      });
    }

    device.zoneId = null;
    await device.save();

    res.json({ 
      success: true, 
      message: 'Device removed from zone successfully',
      device 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

describe('Zone Controller Tests', () => {
  let authToken;
  let testUser;
  let testZone;
  let testDevice;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'zonetest@example.com',
      password: 'Test123456!'
    });

    authToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.SECRET_KEY || 'test_secret_key',
      { expiresIn: '1h' }
    );

    // Add a test zone
    testUser.zones.push({
      name: 'Living Room',
      location: {
        address: 'Main living area'
      }
    });
    await testUser.save();
    testZone = testUser.zones[0];

    // Create a test device
    testDevice = await Device.create({
      userId: testUser._id,
      deviceId: 'ZONE_TEST_DEVICE',
      name: 'Zone Test Sensor',
      type: 'temperature',
      image: 'icon.png',
      zoneId: testZone._id
    });
  });

  describe('GET /api/zones', () => {
    it('should get all zones for user', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should return empty array for user with no zones', async () => {
      const newUser = await User.create({
        email: 'nozones@example.com',
        username: 'nozonesuser',
        password: 'Test123456!'
      });

      const newToken = jwt.sign(
        { id: newUser._id, email: newUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/zones')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/zones')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/zones/:id', () => {
    it('should get zone by id', async () => {
      const response = await request(app)
        .get(`/api/zones/${testZone._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Living Room');
      expect(response.body.location).toHaveProperty('address', 'Main living area');
    });

    it('should return 404 for non-existent zone', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/zones/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('message', 'Zone not found');
    });
  });

  describe('POST /api/zones', () => {
    it('should create a new zone', async () => {
      const newZone = {
        name: 'Bedroom',
        location: {
          address: 'Master bedroom'
        }
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newZone)
        .expect(201);

      expect(response.body).toHaveProperty('name', 'Bedroom');
      expect(response.body.location).toHaveProperty('address', 'Master bedroom');
      expect(response.body).toHaveProperty('_id');
    });

    it('should create zone with minimal data', async () => {
      const minimalZone = {
        name: 'Kitchen'
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalZone)
        .expect(201);

      expect(response.body).toHaveProperty('name', 'Kitchen');
    });

    it('should validate required name field', async () => {
      const invalidZone = {
        location: { address: 'No name zone' }
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidZone)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });

    it('should not allow duplicate zone names', async () => {
      const duplicateZone = {
        name: 'Living Room' // Already exists
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateZone)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });

    it('should reject empty name', async () => {
      const emptyName = {
        name: '   '
      };

      const response = await request(app)
        .post('/api/zones')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emptyName)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/zones/:id', () => {
    it('should update zone successfully', async () => {
      const updateData = {
        name: 'Updated Living Room',
        location: {
          address: 'Updated description'
        }
      };

      const response = await request(app)
        .put(`/api/zones/${testZone._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Updated Living Room');
      expect(response.body.location).toHaveProperty('address', 'Updated description');
    });

    it('should update only specified fields', async () => {
      const partialUpdate = {
        name: 'Just Name Update'
      };

      const response = await request(app)
        .put(`/api/zones/${testZone._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Just Name Update');
    });

    it('should return 404 for non-existent zone', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/zones/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('DELETE /api/zones/:id', () => {
    it('should not delete zone with assigned devices', async () => {
      const response = await request(app)
        .delete(`/api/zones/${testZone._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('assigned devices');
    });

    it('should delete zone without devices', async () => {
      // Create a zone without devices
      testUser.zones.push({ name: 'Empty Zone' });
      await testUser.save();
      const emptyZone = testUser.zones[testUser.zones.length - 1];

      const response = await request(app)
        .delete(`/api/zones/${emptyZone._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Zone deleted successfully');

      // Verify zone was deleted
      const updatedUser = await User.findById(testUser._id);
      const deletedZone = updatedUser.zones.id(emptyZone._id);
      expect(deletedZone).toBeNull();
    });

    it('should return 404 for non-existent zone', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/zones/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/zones/:id/devices', () => {
    it('should get all devices in zone', async () => {
      const response = await request(app)
        .get(`/api/zones/${testZone._id}/devices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].zoneId.toString()).toBe(testZone._id.toString());
    });

    it('should return empty array for zone with no devices', async () => {
      testUser.zones.push({ name: 'Empty Zone' });
      await testUser.save();
      const emptyZone = testUser.zones[testUser.zones.length - 1];

      const response = await request(app)
        .get(`/api/zones/${emptyZone._id}/devices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/zones/:id/assign-device', () => {
    it('should assign device to zone', async () => {
      const unassignedDevice = await Device.create({
        userId: testUser._id,
        deviceId: 'UNASSIGNED_DEVICE',
        name: 'Unassigned Sensor',
        type: 'humidity',
        image: 'icon.png'
      });

      const response = await request(app)
        .post(`/api/zones/${testZone._id}/assign-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deviceId: unassignedDevice._id })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.device.zoneId.toString()).toBe(testZone._id.toString());

      // Verify device was assigned
      const updatedDevice = await Device.findById(unassignedDevice._id);
      expect(updatedDevice.zoneId.toString()).toBe(testZone._id.toString());
    });

    it('should require deviceId', async () => {
      const response = await request(app)
        .post(`/api/zones/${testZone._id}/assign-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/zones/${testZone._id}/assign-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deviceId: fakeId })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/zones/:id/remove-device', () => {
    it('should remove device from zone', async () => {
      const response = await request(app)
        .post(`/api/zones/${testZone._id}/remove-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deviceId: testDevice._id })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.device.zoneId).toBeNull();

      // Verify device was removed
      const updatedDevice = await Device.findById(testDevice._id);
      expect(updatedDevice.zoneId).toBeNull();
    });

    it('should require deviceId', async () => {
      const response = await request(app)
        .post(`/api/zones/${testZone._id}/remove-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if device not in zone', async () => {
      const otherDevice = await Device.create({
        userId: testUser._id,
        deviceId: 'OTHER_DEVICE',
        name: 'Other Sensor',
        type: 'temperature',
        image: 'icon.png',
        zoneId: null
      });

      const response = await request(app)
        .post(`/api/zones/${testZone._id}/remove-device`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ deviceId: otherDevice._id })
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not found in this zone');
    });
  });
});