const mongoose = require('mongoose');
const Device = require('../../models/Device');
const User = require('../../models/User');

describe('Device Model Tests', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'deviceowner@example.com',
      password: 'Pass123!'
    });
  });

  describe('Device Schema Validation', () => {
    it('should create a device with valid data', async () => {
      const validDevice = {
        userId: testUser._id,
        name: 'Temperature Sensor',
        type: 'temperature',
        image: 'sensor-icon.png',
        deviceId: 'DEVICE_001',
        status: 'Connected'
      };

      const device = await Device.create(validDevice);

      expect(device._id).toBeDefined();
      expect(device.name).toBe(validDevice.name);
      expect(device.type).toBe(validDevice.type);
      expect(device.status).toBe('Connected');
    });

    it('should fail without required userId', async () => {
      const deviceWithoutUser = {
        name: 'Test Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_002'
      };

      await expect(Device.create(deviceWithoutUser)).rejects.toThrow();
    });

    it('should fail without required name', async () => {
      const deviceWithoutName = {
        userId: testUser._id,
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_003'
      };

      await expect(Device.create(deviceWithoutName)).rejects.toThrow();
    });

    it('should use default status "Connected"', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Test Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_006'
      });

      expect(device.status).toBe('Connected');
    });

    it('should auto-generate createdAt timestamp', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Test Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_007'
      });

      expect(device.createdAt).toBeDefined();
      expect(device.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Zone Association', () => {
    it('should allow null zoneId by default', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Unassigned Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_008'
      });

      expect(device.zoneId).toBeNull();
    });

    it('should accept valid zoneId', async () => {
      const zoneId = new mongoose.Types.ObjectId();
      const device = await Device.create({
        userId: testUser._id,
        zoneId: zoneId,
        name: 'Zone Device',
        type: 'humidity',
        image: 'icon.png',
        deviceId: 'DEV_009'
      });

      expect(device.zoneId).toEqual(zoneId);
    });
  });

  describe('Location Data', () => {
    it('should store location with coordinates', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Located Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_011',
        location: {
          latitude: 18.7883,
          longitude: 98.9853,
          address: 'Chiang Rai, Thailand'
        }
      });

      expect(device.location.latitude).toBe(18.7883);
      expect(device.location.longitude).toBe(98.9853);
      expect(device.location.address).toBe('Chiang Rai, Thailand');
    });

    it('should use default null for location fields', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'No Location Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_012'
      });

      expect(device.location.latitude).toBeNull();
      expect(device.location.longitude).toBeNull();
      expect(device.location.address).toBe('');
    });
  });

  describe('Sensor Data Storage', () => {
    it('should store sensor data with all fields', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Multi-Sensor Device',
        type: 'environmental',
        image: 'icon.png',
        deviceId: 'DEV_014',
        data: [{
          sensorId: 'SENSOR_001',
          temperature: 25.5,
          humidity: 60,
          co2: 400,
          ec: 1.2,
          ph: 6.5,
          dew_point: 17.2,
          vpd: 1.1,
          timestamp: new Date().toISOString()
        }]
      });

      expect(device.data).toHaveLength(1);
      expect(device.data[0].temperature).toBe(25.5);
      expect(device.data[0].humidity).toBe(60);
      expect(device.data[0].co2).toBe(400);
      expect(device.data[0].ph).toBe(6.5);
    });

    it('should use null defaults for optional sensor fields', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Minimal Sensor Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_016',
        data: [{
          timestamp: new Date().toISOString()
        }]
      });

      expect(device.data[0].temperature).toBeNull();
      expect(device.data[0].humidity).toBeNull();
      expect(device.data[0].co2).toBeNull();
    });

    it('should store multiple sensor readings', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Multi-Reading Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_017',
        data: [
          {
            temperature: 25.0,
            timestamp: new Date().toISOString()
          },
          {
            temperature: 25.5,
            timestamp: new Date().toISOString()
          },
          {
            temperature: 26.0,
            timestamp: new Date().toISOString()
          }
        ]
      });

      expect(device.data).toHaveLength(3);
      expect(device.data[0].temperature).toBe(25.0);
      expect(device.data[1].temperature).toBe(25.5);
      expect(device.data[2].temperature).toBe(26.0);
    });

    it('should add new sensor data to existing device', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Append Data Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DEV_018',
        data: [{
          temperature: 25.0,
          timestamp: new Date().toISOString()
        }]
      });

      device.data.push({
        temperature: 26.0,
        timestamp: new Date().toISOString()
      });
      await device.save();

      const updated = await Device.findById(device._id);
      expect(updated.data).toHaveLength(2);
    });
  });

  describe('Query Operations', () => {
    it('should find device by deviceId', async () => {
      await Device.create({
        userId: testUser._id,
        name: 'Findable Device',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'FIND_ME_001'
      });

      const device = await Device.findOne({ deviceId: 'FIND_ME_001' });
      expect(device).toBeDefined();
      expect(device.name).toBe('Findable Device');
    });

    it('should find all devices for a user', async () => {
      await Device.create([
        {
          userId: testUser._id,
          name: 'Device 1',
          type: 'temperature',
          image: 'icon.png',
          deviceId: 'USER_DEV_001'
        },
        {
          userId: testUser._id,
          name: 'Device 2',
          type: 'humidity',
          image: 'icon.png',
          deviceId: 'USER_DEV_002'
        }
      ]);

      const devices = await Device.find({ userId: testUser._id });
      expect(devices.length).toBeGreaterThanOrEqual(2);
    });

    it('should update device fields', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Update Me',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'UPDATE_001'
      });

      device.name = 'Updated Name';
      device.status = 'Disconnected';
      await device.save();

      const updated = await Device.findById(device._id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.status).toBe('Disconnected');
    });

    it('should delete device', async () => {
      const device = await Device.create({
        userId: testUser._id,
        name: 'Delete Me',
        type: 'temperature',
        image: 'icon.png',
        deviceId: 'DELETE_001'
      });

      await Device.findByIdAndDelete(device._id);

      const deleted = await Device.findById(device._id);
      expect(deleted).toBeNull();
    });
  });
});