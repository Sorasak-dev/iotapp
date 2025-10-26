require('dotenv').config();
const mongoose = require('mongoose');
const Anomaly = require('./models/Anomaly');
const Device = require('./models/Device');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGO_URI;

const testAnomalies = [
  {
    deviceIndex: 0,  // Device แรก (E-MIB1)
    type: 'temperature_high',
    alertLevel: 'red',
    message: 'Temperature critically high at 45.5°C',
    temperature: 45.5,
    humidity: 65.2,
    resolved: false
  },
  {
    deviceIndex: 1,  // Device ที่สอง (E-MIB2)
    type: 'ml_detected',
    alertLevel: 'yellow',
    message: 'ML detected: High humidity (92.3%)',
    temperature: 28.5,
    humidity: 92.3,
    resolved: false
  },
  {
    deviceIndex: 0,  // Device แรก
    type: 'battery_depleted',
    alertLevel: 'yellow',
    message: 'Battery level critically low at 18%',
    temperature: 25.3,
    humidity: 55.8,
    battery_level: 18,
    resolved: false
  },
  {
    deviceIndex: 0,  // Device แรก
    type: 'sensor_malfunction',
    alertLevel: 'red',
    message: 'Sensor data lost - malfunction detected',
    temperature: null,
    humidity: null,
    resolved: true  // Resolved
  },
  {
    deviceIndex: 1,  // Device ที่สอง
    type: 'vpd_too_low',
    alertLevel: 'yellow',
    message: 'VPD too low at 0.35 kPa - poor transpiration',
    temperature: 22.5,
    humidity: 88.5,
    vpd: 0.35,
    resolved: false
  }
];

async function createTestAnomalies() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ค้นหา user
    const user = await User.findOne({ email: 'mewza@gmail.com' });
    if (!user) {
      throw new Error('User not found');
    }
    console.log(`✅ Found user: ${user.email}`);

    // ค้นหา devices ของ user
    const devices = await Device.find({ userId: user._id }).limit(4);
    if (devices.length === 0) {
      throw new Error('No devices found');
    }
    console.log(`✅ Found ${devices.length} devices`);
    
    // แสดง device info
    devices.forEach((device, index) => {
      console.log(`   Device ${index}: ${device.name} (ID: ${device._id})`);
    });

    console.log('\n📝 Creating test anomalies...');

    let createdCount = 0;
    
    for (const testData of testAnomalies) {
      const device = devices[testData.deviceIndex];
      if (!device) {
        console.log(`⚠️  Device index ${testData.deviceIndex} not found, skipping...`);
        continue;
      }

      const anomalyData = {
        deviceId: device._id.toString(),  // ✅ ใช้ MongoDB _id จริง
        userId: user._id,
        timestamp: new Date(),
        
        sensorData: {
          temperature: testData.temperature ?? null,
          humidity: testData.humidity ?? null,
          co2: testData.co2 ?? null,
          ec: testData.ec ?? null,
          ph: testData.ph ?? null,
          voltage: testData.voltage ?? null,
          battery_level: testData.battery_level ?? null,
          dew_point: testData.dew_point ?? null,
          vpd: testData.vpd ?? null
        },
        
        status: 'completed',
        resolved: testData.resolved || false,
        
        ruleBasedDetection: {
          anomaliesFound: true,
          anomalies: [{
            type: testData.type,
            alertLevel: testData.alertLevel,
            message: testData.message,
            priority: testData.alertLevel === 'red' ? 4 : 2,
            confidence: 0.95,
            timestamp: new Date(),
            data: {
              temperature: testData.temperature,
              humidity: testData.humidity
            }
          }],
          totalAnomalies: 1
        },
        
        mlDetection: {
          anomaliesFound: false,
          modelsAvailable: false
        },
        
        summary: {
          ruleAnomaliesFound: true,
          mlAnomaliesFound: false,
          totalAnomalies: 1,
          alertLevel: testData.alertLevel,
          riskLevel: testData.alertLevel === 'red' ? 'high' : 'medium',
          priorityScore: testData.alertLevel === 'red' ? 4 : 2,
          healthScore: testData.alertLevel === 'red' ? 60 : 80,
          confidenceScores: {
            ruleBased: 0.95,
            mlBased: 0,
            combined: 0.95,
            weightedAverage: 0.95
          }
        },
        
        alertMessage: {
          level: testData.alertLevel === 'red' ? 'critical' : 'warning',
          title: testData.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          message: testData.message,
          icon: testData.alertLevel === 'red' ? 'CRITICAL' : 'WARNING',
          confidence: 0.95,
          priorityScore: testData.alertLevel === 'red' ? 4 : 2,
          healthScore: testData.alertLevel === 'red' ? 60 : 80,
          riskLevel: testData.alertLevel === 'red' ? 'high' : 'medium',
          totalAnomalies: 1
        }
      };

      const anomaly = new Anomaly(anomalyData);
      await anomaly.save();
      
      createdCount++;
      console.log(`✅ Created anomaly #${createdCount}: {
  type: '${testData.type}',
  device: '${device.name}',
  deviceId: '${device._id}',
  alertLevel: '${testData.alertLevel}',
  resolved: ${testData.resolved}
}`);
    }

    console.log('\n==================================================');
    console.log(`✅ Successfully created ${createdCount}/${testAnomalies.length} test anomalies!`);
    console.log('==================================================');

    // แสดงสรุป
    const redCount = await Anomaly.countDocuments({ 
      'summary.alertLevel': 'red',
      userId: user._id 
    });
    const yellowCount = await Anomaly.countDocuments({ 
      'summary.alertLevel': 'yellow',
      userId: user._id 
    });
    const totalCount = await Anomaly.countDocuments({ userId: user._id });

    console.log('📊 Database Summary:');
    console.log(`   RED: ${redCount} anomalies`);
    console.log(`   YELLOW: ${yellowCount} anomalies`);
    console.log(`   TOTAL: ${totalCount} anomalies`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAnomalies();