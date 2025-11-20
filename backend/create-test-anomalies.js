require("dotenv").config();
const mongoose = require("mongoose");
const Anomaly = require("./models/Anomaly");
const Device = require("./models/Device");
const User = require("./models/User");

const MONGODB_URI = process.env.MONGO_URI;

// ฟังก์ชันสุ่มค่าเซนเซอร์แบบหลุดโลก
function generateWeirdSensorData() {
  return {
    temperature: (Math.random() * 120) - 20,     // -20 → 100°C
    humidity: (Math.random() * 130) - 10,        // -10% → 120%
    co2: Math.random() * 12000,                  // 0 → 12,000 ppm
    ec: Math.random() * 10,                      // 0 → 10 dS/m
    ph: (Math.random() * 18) - 2,                // -2 → 16
    voltage: Math.random() * 10,                 // 0 → 10V
    battery_level: (Math.random() * 130) - 10,   // -10 → 120%
    dew_point: (Math.random() * 60) - 15,        // -15 → 45°C
    vpd: (Math.random() * 3) - 0.5               // -0.5 → 2.5 kPa
  };
}

// สุ่มประเภท anomaly
function randomAnomalyType() {
  const types = [
    "temperature_high",
    "temperature_low",
    "humidity_high",
    "humidity_low",
    "co2_abnormal",
    "battery_depleted",
    "sensor_malfunction",
    "ml_detected",
    "vpd_too_low",
    "vpd_too_high"
  ];
  return types[Math.floor(Math.random() * types.length)];
}

// สุ่ม alertLevel
function randomAlertLevel() {
  return Math.random() > 0.6 ? "red" : "yellow";
}

// สร้าง message อัตโนมัติ
function generateMessage(type, data) {
  return `${type.replace(/_/g, " ")} detected with abnormal values: temp=${data.temperature?.toFixed(
    1
  )}°C, hum=${data.humidity?.toFixed(1)}%`;
}

async function createTestAnomalies() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ email: "mewza@gmail.com" });
    if (!user) throw new Error("User not found");

    const devices = await Device.find({ userId: user._id }).limit(4);
    if (devices.length === 0) throw new Error("No devices found");

    console.log(`📡 Found ${devices.length} devices`);

    console.log("\n🧪 Creating RANDOM weird anomalies...\n");

    let createdCount = 0;

    for (let i = 0; i < 20; i++) {
      const device = devices[Math.floor(Math.random() * devices.length)];

      const sensorData = generateWeirdSensorData();
      const type = randomAnomalyType();
      const alertLevel = randomAlertLevel();
      const message = generateMessage(type, sensorData);

      const anomalyData = {
        deviceId: device._id.toString(),
        userId: user._id,
        timestamp: new Date(),
        sensorData: sensorData,

        status: "completed",
        resolved: false,

        ruleBasedDetection: {
          anomaliesFound: true,
          anomalies: [
            {
              type,
              alertLevel,
              message,
              priority: alertLevel === "red" ? 4 : 2,
              confidence: 0.8 + Math.random() * 0.2, // 0.8–1.0
              timestamp: new Date(),
              data: sensorData,
            },
          ],
          totalAnomalies: 1,
        },

        mlDetection: {
          anomaliesFound: Math.random() > 0.7, // 30% chance ML detects
          modelsAvailable: true,
        },

        summary: {
          ruleAnomaliesFound: true,
          mlAnomaliesFound: false,
          totalAnomalies: 1,
          alertLevel,
          riskLevel: alertLevel === "red" ? "high" : "medium",
          priorityScore: alertLevel === "red" ? 4 : 2,
          healthScore: alertLevel === "red" ? 50 : 85,
          confidenceScores: {
            ruleBased: 0.9,
            mlBased: 0.1,
            combined: 0.95,
            weightedAverage: 0.92,
          },
        },

        alertMessage: {
          level: alertLevel === "red" ? "critical" : "warning",
          title: type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          message,
          icon: alertLevel === "red" ? "CRITICAL" : "WARNING",
          confidence: 0.9,
          priorityScore: alertLevel === "red" ? 4 : 2,
          healthScore: alertLevel === "red" ? 50 : 85,
          riskLevel: alertLevel === "red" ? "high" : "medium",
          totalAnomalies: 1,
        },
      };

      await new Anomaly(anomalyData).save();

      createdCount++;
      console.log(
        `🔥 Random anomaly #${createdCount} → ${type} (${alertLevel})`
      );
    }

    console.log("\n==================================================");
    console.log(`🎉 Created ${createdCount} random anomalies`);
    console.log("==================================================");

    await mongoose.disconnect();
    console.log("⬅️ Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

createTestAnomalies();
 