const mongoose = require('mongoose');
const pushNotificationService = require('../services/pushNotificationService');
const User = require('../models/User');
const PushToken = require('../models/PushToken');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/auth-demo";

async function testPushNotifications() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('Test user not found. Please create a test user first.');
      process.exit(1);
    }

    console.log(`Testing push notifications for user: ${testUser.email}`);

    const tokens = await PushToken.find({ userId: testUser._id, isActive: true });
    console.log(`Found ${tokens.length} active push tokens`);

    if (tokens.length === 0) {
      console.log('No active push tokens found. Register a device first.');
      process.exit(1);
    }

    console.log('Test 1: Sending test notification...');
    try {
      const result = await pushNotificationService.sendTestNotification(testUser._id);
      console.log('Test notification result:', result.success ? 'Success' : 'Failed');
      if (!result.success) {
        console.log('Reason:', result.reason);
      }
    } catch (error) {
      console.error('Test notification failed:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Test 2: Sending mock anomaly alert...');
    try {
      const mockAnomaly = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        deviceId: 'test-device-1',
        anomalyType: 'temperature_high',
        alertLevel: 'critical',
        message: 'Critical temperature anomaly detected',
        timestamp: new Date()
      };

      const result = await pushNotificationService.sendAnomalyAlert(mockAnomaly);
      console.log('Anomaly alert result:', result.success ? 'Success' : 'Failed');
      if (!result.success) {
        console.log('Reason:', result.reason);
      }
    } catch (error) {
      console.error('Anomaly alert failed:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Test 3: Sending device status alert...');
    try {
      const result = await pushNotificationService.sendDeviceAlert(
        testUser._id,
        'test-device-1',
        'Test Sensor',
        'Low Battery',
        'Device battery is below 20%'
      );
      console.log('Device alert result:', result.success ? 'Success' : 'Failed');
      if (!result.success) {
        console.log('Reason:', result.reason);
      }
    } catch (error) {
      console.error('Device alert failed:', error.message);
    }

    console.log('Checking delivery statistics...');
    try {
      const stats = await pushNotificationService.getDeliveryStats(1);
      console.log('Last 24h delivery stats:', stats);
    } catch (error) {
      console.error('Stats check failed:', error.message);
    }

    console.log('Processing delivery queue...');
    try {
      const result = await pushNotificationService.processDeliveryQueue();
      console.log(`Processed ${result.processed} notifications from queue`);
    } catch (error) {
      console.error('Queue processing failed:', error.message);
    }

    console.log('All push notification tests completed!');
    console.log('Check your device for received notifications');
    
  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

process.on('SIGINT', async () => {
  console.log('Test script interrupted');
  await mongoose.connection.close();
  process.exit(0);
});

testPushNotifications();