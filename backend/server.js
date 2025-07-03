const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { spawn } = require('child_process');
const path = require('path');
require("dotenv").config();

const authenticateToken = require("./middleware/authMiddleware");
const errorHandler = require("./middleware/errorHandler");
const { userValidationSchema } = require("./validation/userValidation");
const User = require("./models/User");
const Device = require("./models/Device");
const Anomaly = require("./models/Anomaly");  
const userRoutes = require('./routes/userRoutes'); 
const anomalyDetectionRoutes = require('./routes/anomalyRoutes');  

const app = express();

// Environment variables
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/auth-demo";
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/api/users", userRoutes);
app.use("/api", anomalyDetectionRoutes);  

// Connect to MongoDB
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Available Device Templates (4 devices)
const deviceTemplates = [
  {
    id: "1",
    name: "E-MIB1",
    type: "Temperature & Humidity Sensor",
    image: "sensor.png",
    description: "Advanced environmental monitoring sensor"
  },
  {
    id: "2", 
    name: "E-MIB2",
    type: "Temperature & Humidity Sensor",
    image: "sensor2.png",
    description: "Precision climate monitoring device"
  },
  {
    id: "3",
    name: "E-MIB3", 
    type: "Temperature & Humidity Sensor",
    image: "sensor3.png",
    description: "Industrial grade environmental sensor"
  },
  {
    id: "4",
    name: "E-MIB4",
    type: "Temperature & Humidity Sensor", 
    image: "sensor4.png",
    description: "Smart wireless monitoring sensor"
  }
];

// Simulate Sensor Data (เพิ่ม voltage และ battery_level)
const generateSensorData = (deviceId) => {
  const shouldBeNull = Math.random() < 0.1;

  const temperature = shouldBeNull ? null : parseFloat((Math.random() * (40 - 20) + 20).toFixed(2));
  let humidity, co2, ec, ph;

  if (shouldBeNull) {
    humidity = null;
    co2 = null;
    ec = null;
    ph = null;
  } else {
    // Add some variation based on deviceId for different readings
    const deviceVariation = parseInt(deviceId) || 1;
    humidity = parseFloat((Math.random() * (80 - 30) + 30 + deviceVariation).toFixed(2));
    co2 = parseInt(Math.random() * (1000 - 200) + 200 + (deviceVariation * 50), 10);
    ec = parseFloat((Math.random() * (2.0 - 0.5) + 0.5 + (deviceVariation * 0.1)).toFixed(2));
    ph = parseFloat((Math.random() * (9 - 4) + 4 + (deviceVariation * 0.2)).toFixed(2));
  }

  let dewPoint = null, vpd = null;
  if (temperature !== null && humidity !== null) {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
    dewPoint = (b * alpha) / (a - alpha);
    dewPoint = parseFloat(dewPoint.toFixed(2));

    const saturationVaporPressure = 0.6108 * Math.exp((17.27 * temperature) / (temperature + 237.3));
    const actualVaporPressure = saturationVaporPressure * (humidity / 100);
    vpd = parseFloat((saturationVaporPressure - actualVaporPressure).toFixed(2));
  }

  // เพิ่ม voltage และ battery_level สำหรับ anomaly detection
  const voltage = shouldBeNull ? null : parseFloat((Math.random() * (3.4 - 3.2) + 3.2).toFixed(2));
  const battery_level = shouldBeNull ? null : parseInt(Math.random() * (100 - 80) + 80, 10);

  return {
    temperature,
    humidity,
    co2,
    ec,
    ph,
    dew_point: dewPoint,
    vpd: vpd,
    voltage,           // เพิ่มใหม่
    battery_level,     // เพิ่มใหม่
    timestamp: new Date().toISOString(),
  };
};

// Create test user and initial setup
const createTestUser = async () => {
  const testEmail = "test@example.com";
  let user = await User.findOne({ email: testEmail });
  if (!user) {
    user = new User({
      email: testEmail,
      password: await bcrypt.hash("password123", 10),
    });
    await user.save();
    console.log("✅ Created test user:", testEmail);
  }
  return user._id;
};

// Simulate sensor data for all connected devices every hour
const simulateSensorDataForAllDevices = async () => {
  try {
    const connectedDevices = await Device.find({ status: 'Connected' });
    
    for (const device of connectedDevices) {
      const sensorData = generateSensorData(device.deviceId);
      
      // Add new data to device
      device.data.push(sensorData);
      
      // Keep only last 1000 readings to prevent database bloat
      if (device.data.length > 1000) {
        device.data = device.data.slice(-1000);
      }
      
      await device.save();
      console.log(`📊 Generated sensor data for device ${device.name} (${device.deviceId})`);
    }
  } catch (error) {
    console.error("❌ Error generating sensor data:", error);
  }
};

// Initialize historical data for new devices
const initializeHistoricalData = async (device) => {
  const now = new Date();
  const daysBack = 30; // 30 days of historical data
  const intervalHours = 4; // Data every 4 hours
  const totalRecords = daysBack * (24 / intervalHours);

  for (let i = 0; i < totalRecords; i++) {
    const pastDate = new Date(now.getTime() - i * intervalHours * 60 * 60 * 1000);
    const sensorData = {
      ...generateSensorData(device.deviceId),
      timestamp: pastDate.toISOString()
    };
    
    device.data.push(sensorData);
  }

  await device.save();
  console.log(`✅ Initialized ${totalRecords} historical records for device ${device.name}`);
};

// Start sensor data simulation every 1 hour
setInterval(simulateSensorDataForAllDevices, 3600000); // 1 hour = 3600000ms

// ===== เพิ่ม Anomaly Detection Service =====
let anomalyMonitor = null;

const startAnomalyMonitoring = () => {
  const pythonPath = path.join(__dirname, 'anomaly-detection/integration_example.py');
  const pythonDir = path.join(__dirname, 'anomaly-detection');
  
  console.log('🔄 Starting Anomaly Detection Service...');
  console.log(`📁 Python script: ${pythonPath}`);
  
  // ตรวจสอบว่าไฟล์ Python มีอยู่หรือไม่
  const fs = require('fs');
  if (!fs.existsSync(pythonPath)) {
    console.log('⚠️ Anomaly Detection script not found. Skipping...');
    console.log(`📁 Expected path: ${pythonPath}`);
    return null;
  }
  
  const monitorProcess = spawn('python', [pythonPath, 'monitor'], {
    cwd: pythonDir,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  monitorProcess.stdout.on('data', (data) => {
    console.log('🤖 Anomaly Monitor:', data.toString().trim());
  });
  
  monitorProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg && !errorMsg.includes('WARNING')) {
      console.error('⚠️ Anomaly Monitor Warning:', errorMsg);
    }
  });
  
  monitorProcess.on('close', (code) => {
    console.log(`🛑 Anomaly Monitor stopped with code ${code}`);
    
    // Auto-restart หากหยุดทำงานโดยไม่คาดคิด (และไม่ใช่การ shutdown ปกติ)
    if (code !== 0 && code !== null) {
      console.log('🔄 Restarting Anomaly Monitor in 30 seconds...');
      setTimeout(startAnomalyMonitoring, 30000);
    }
  });
  
  monitorProcess.on('error', (error) => {
    console.error('❌ Anomaly Monitor Error:', error.message);
    console.log('💡 Make sure Python environment is set up correctly');
    console.log('💡 Run: cd anomaly-detection && python integration_example.py test');
  });
  
  console.log('✅ Anomaly Detection Service started');
  return monitorProcess;
};

// ===== Fixed Graceful shutdown =====
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  // หยุด Anomaly Monitor
  if (anomalyMonitor) {
    console.log('🛑 Stopping Anomaly Detection Service...');
    try {
      anomalyMonitor.kill('SIGTERM');
      // รอให้ process หยุด
      setTimeout(() => {
        if (anomalyMonitor && !anomalyMonitor.killed) {
          anomalyMonitor.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      console.error('⚠️ Error stopping anomaly monitor:', error.message);
    }
    anomalyMonitor = null;
  }
  
  // ปิด MongoDB connection (ใช้ async/await แทน callback)
  try {
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
  } catch (error) {
    console.error('⚠️ Error closing MongoDB connection:', error.message);
  }
  
  // ปิด Express server
  console.log('✅ Server shutdown complete');
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Routes
app.get('/', (req, res) => {
  res.send('Hello! Backend Server with Anomaly Detection is running. 🚀🤖');
});

// API: Get available device templates
app.get("/api/device-templates", (req, res) => {
  res.status(200).json({ 
    message: "Available device templates",
    templates: deviceTemplates 
  });
});

// API: Get all devices for a user
app.use("/api/devices", require("./routes/deviceRoutes"));
app.use("/api/zones", require("./routes/zoneRoutes"));

// ✅ Sign Up
app.post("/api/signup", async (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ message: "Email already exists" });
    const newUser = new User({ email, password });

    await newUser.save();
    res.status(201).json({ message: "User created successfully!" });
  } catch (err) {
    next(err);
  }
});

// ✅ Sign In
app.post("/api/signin", async (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    console.log("Stored hashed password:", user.password);
    console.log("Input password:", password);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password comparison result:", isPasswordValid);

    if (!isPasswordValid) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    next(err);
  }
});

// Legacy API: Get sensor data (for backward compatibility)
app.get('/api/user/sensor-data', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Get user's first device for backward compatibility
    const device = await Device.findOne({ userId });
    if (!device) {
      return res.status(404).json({ message: 'No devices found' });
    }

    let filteredData = device.data;

    if (startDate && endDate) {
      filteredData = device.data.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate + "T23:59:59");
      });

      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (daysDiff <= 2) {
        res.status(200).json({ data: filteredData });
      } else {
        // Calculate daily averages
        const dailyData = {};
        filteredData.forEach(item => {
          const date = new Date(item.timestamp).toISOString().split("T")[0];
          if (!dailyData[date]) {
            dailyData[date] = {
              temperature: { sum: 0, count: 0 },
              humidity: { sum: 0, count: 0 },
              dew_point: { sum: 0, count: 0 },
              vpd: { sum: 0, count: 0 },
              timestamp: item.timestamp,
            };
          }
          if (item.temperature !== null) {
            dailyData[date].temperature.sum += item.temperature;
            dailyData[date].temperature.count += 1;
          }
          if (item.humidity !== null) {
            dailyData[date].humidity.sum += item.humidity;
            dailyData[date].humidity.count += 1;
          }
          if (item.dew_point !== null) {
            dailyData[date].dew_point.sum += item.dew_point;
            dailyData[date].dew_point.count += 1;
          }
          if (item.vpd !== null) {
            dailyData[date].vpd.sum += item.vpd;
            dailyData[date].vpd.count += 1;
          }
          if (new Date(item.timestamp) > new Date(dailyData[date].timestamp)) {
            dailyData[date].timestamp = item.timestamp;
          }
        });

        const averagedData = Object.keys(dailyData).map(date => ({
          temperature: dailyData[date].temperature.count > 0 
            ? parseFloat((dailyData[date].temperature.sum / dailyData[date].temperature.count).toFixed(2)) 
            : null,
          humidity: dailyData[date].humidity.count > 0 
            ? parseFloat((dailyData[date].humidity.sum / dailyData[date].humidity.count).toFixed(2)) 
            : null,
          dew_point: dailyData[date].dew_point.count > 0 
            ? parseFloat((dailyData[date].dew_point.sum / dailyData[date].dew_point.count).toFixed(2)) 
            : null,
          vpd: dailyData[date].vpd.count > 0 
            ? parseFloat((dailyData[date].vpd.sum / dailyData[date].vpd.count).toFixed(2)) 
            : null,
          timestamp: dailyData[date].timestamp,
        }));

        res.status(200).json({ data: averagedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) });
      }
    } else {
      res.status(200).json({ data: filteredData });
    }
  } catch (err) {
    next(err);
  }
});

// Global Error Handling Middleware
app.use(errorHandler);

// Initialize and start the server
const initializeServer = async () => {
  try {
    // Create test user and start sensor simulation
    await createTestUser();
    
    // Start sensor data generation immediately
    setTimeout(simulateSensorDataForAllDevices, 5000); // Start after 5 seconds
    
    // เริ่ม Anomaly Detection Service (รอให้ server เสถียรก่อน)
    setTimeout(() => {
      anomalyMonitor = startAnomalyMonitoring();
    }, 15000); // รอ 15 วินาทีให้ server และ sensor simulation เสถียร
    
    console.log("✅ All services initialized");
  } catch (error) {
    console.error("❌ Server initialization error:", error);
  }
};

// Start the server with proper error handling
let server;

const startServer = () => {
  server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    initializeServer();
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    gracefulShutdown();
  });
};

startServer();