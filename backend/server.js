const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { spawn } = require('child_process');
const path = require('path');
const cron = require('node-cron');
const Joi = require('joi');
require("dotenv").config();

const authenticateToken = require("./middleware/authMiddleware");
const errorHandler = require("./middleware/errorHandler");
const { userValidationSchema } = require("./validation/userValidation");
const User = require("./models/User");
const Device = require("./models/Device");
const Anomaly = require("./models/Anomaly");
const PushToken = require("./models/PushToken");
const Notification = require("./models/Notification");

const userRoutes = require('./routes/userRoutes'); 
const anomalyDetectionRoutes = require('./routes/anomalyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const pushNotificationService = require('./services/pushNotificationService');

const app = express();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/auth-demo";
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const PORT = process.env.PORT || 3000;


class SystemHealthMonitor {
  constructor() {
    this.metrics = {
      anomaly_detection_uptime: 0,
      model_accuracy: 0,
      notification_success_rate: 0,
      last_health_check: null,
      python_process_restarts: 0,
      total_anomalies_processed: 0,
      error_count: 0
    };
    
    this.alerts = {
      consecutive_failures: 0,
      last_alert_sent: null,
      alert_threshold: 3
    };
  }
  
  async checkSystemHealth() {
    try {
      console.log('Performing system health check...');
      
      const mongoHealth = mongoose.connection.readyState === 1;
      
      const pythonHealth = await this.checkPythonService();
      
      const notificationHealth = await this.checkNotificationService();
      
      this.metrics.last_health_check = new Date().toISOString();
      
      const healthScore = this.calculateHealthScore(mongoHealth, pythonHealth, notificationHealth);
      
      if (healthScore < 0.7) {
        await this.alertAdmins(`System health degraded: ${Math.round(healthScore * 100)}%`);
      } else {
        this.alerts.consecutive_failures = 0;
      }
      
      console.log(`Health check completed. Score: ${Math.round(healthScore * 100)}%`);
      
      return {
        overall_health: healthScore,
        services: {
          mongodb: mongoHealth,
          python_service: pythonHealth,
          notifications: notificationHealth
        },
        metrics: this.metrics
      };
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.metrics.error_count++;
      return { error: error.message };
    }
  }
  
  calculateHealthScore(mongo, python, notifications) {
    const weights = { mongo: 0.4, python: 0.4, notifications: 0.2 };
    return (mongo * weights.mongo) + (python * weights.python) + (notifications * weights.notifications);
  }
  
  async checkPythonService() {
    try {
      return pythonProcessManager.process && !pythonProcessManager.process.killed;
    } catch (error) {
      return false;
    }
  }
  
  async checkNotificationService() {
    try {
      const stats = await pushNotificationService.getDeliveryStats(1);
      return stats && stats.delivered !== undefined;
    } catch (error) {
      return false;
    }
  }
  
  async alertAdmins(message) {
    this.alerts.consecutive_failures++;
    
    const now = Date.now();
    const lastAlert = this.alerts.last_alert_sent ? new Date(this.alerts.last_alert_sent).getTime() : 0;
    const timeSinceLastAlert = now - lastAlert;
    
    if (timeSinceLastAlert < 300000) { 
      return;
    }
    
    if (this.alerts.consecutive_failures >= this.alerts.alert_threshold) {
      console.error(`ADMIN ALERT: ${message}`);
      
      try {
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          await pushNotificationService.sendToUser(
            admin._id,
            'System Alert',
            message,
            { type: 'system_alert', severity: 'high' },
            { type: 'system_update', priority: 'high' }
          );
        }
        this.alerts.last_alert_sent = new Date().toISOString();
      } catch (error) {
        console.error('Failed to send admin alert:', error);
      }
    }
  }
}

class PythonProcessManager {
  constructor() {
    this.process = null;
    this.restartCount = 0;
    this.maxRestarts = 5;
    this.restartDelay = 30000; 
    this.isShuttingDown = false;
    this.healthCheckInterval = null;
    
    this.metrics = {
      startTime: null,
      lastRestart: null,
      totalRestarts: 0,
      uptime: 0
    };
  }
  
  start() {
    if (this.isShuttingDown) {
      console.log('Process manager is shutting down, not starting new process');
      return;
    }
    
    const pythonPath = path.join(__dirname, 'anomaly-detection/integration_bridge.py');
    const pythonDir = path.join(__dirname, 'anomaly-detection');
    
    console.log('Starting Anomaly Detection Service...');

    const fs = require('fs');
    if (!fs.existsSync(pythonPath)) {
      console.log('Anomaly Detection script not found. Skipping...');
      return null;
    }
    
    this.process = spawn('python', [pythonPath, 'monitor'], {
      cwd: pythonDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.metrics.startTime = Date.now();
    this.restartCount = 0; 
    
    this.setupEventHandlers();
    
    this.startHealthCheck();
    
    console.log(`Anomaly Detection Service started (PID: ${this.process.pid})`);
    return this.process;
  }
  
  setupEventHandlers() {
    if (!this.process) return;
    
    this.process.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log('Anomaly Monitor:', output);
      }
    });
    
    this.process.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      if (errorMsg && !errorMsg.includes('WARNING') && !errorMsg.includes('INFO')) {
        console.error('Anomaly Monitor Error:', errorMsg);
      }
    });
    
    this.process.on('close', (code) => {
      this.metrics.uptime = Date.now() - this.metrics.startTime;
      console.log(`Anomaly Monitor stopped with code ${code} (uptime: ${Math.round(this.metrics.uptime/1000)}s)`);
      
      this.stopHealthCheck();
      
      if (!this.isShuttingDown && code !== 0 && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        this.metrics.totalRestarts++;
        this.metrics.lastRestart = Date.now();

        const delay = this.restartDelay * Math.pow(2, this.restartCount - 1);
        console.log(`Restarting Anomaly Monitor in ${delay/1000}s (attempt ${this.restartCount}/${this.maxRestarts})`);

        setTimeout(() => {
          if (!this.isShuttingDown) {
            this.start();
          }
        }, delay);
        
      } else if (this.restartCount >= this.maxRestarts) {
        console.error('Max restart attempts reached. Manual intervention required.');
        systemHealthMonitor.alertAdmins('Anomaly Detection Service failed to start after maximum retries');
      }
    });
    
    this.process.on('error', (error) => {
      console.error('Anomaly Monitor Process Error:', error.message);
      
      if (error.code === 'ENOENT') {
        console.error('Python executable not found. Please check Python installation.');
      } else if (error.code === 'EACCES') {
        console.error('Permission denied. Check file permissions.');
      }
    });
  }
  
  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      if (this.process && !this.process.killed) {
        this.metrics.uptime = Date.now() - this.metrics.startTime;
      }
    }, 60000); 
  }
  
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  async gracefulShutdown() {
    console.log('Shutting down Python Process Manager...');
    this.isShuttingDown = true;
    this.stopHealthCheck();
    
    if (this.process && !this.process.killed) {
      console.log('Stopping Anomaly Detection Service...');
      
      try {
        this.process.kill('SIGTERM');
        
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              console.log('Forcing process termination...');
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
          
          if (this.process) {
            this.process.on('close', () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
        console.log('Anomaly Detection Service stopped');
      } catch (error) {
        console.error('Error stopping anomaly monitor:', error.message);
      }
    }
    
    this.process = null;
  }
  
  getStatus() {
    return {
      running: this.process && !this.process.killed,
      pid: this.process ? this.process.pid : null,
      restartCount: this.restartCount,
      metrics: this.metrics,
      isShuttingDown: this.isShuttingDown
    };
  }
}

const sensorDataSchema = Joi.object({
  deviceId: Joi.string().required().max(50),
  timestamp: Joi.date().iso().required(),
  temperature: Joi.number().min(-50).max(100).allow(null),
  humidity: Joi.number().min(0).max(100).allow(null),
  voltage: Joi.number().min(0).max(5).allow(null),
  battery_level: Joi.number().min(0).max(100).allow(null)
});

const rateLimiter = require('express-rate-limit');

const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10, 
  message: {
    success: false,
    message: 'Rate limit exceeded for this endpoint.'
  }
});

const systemHealthMonitor = new SystemHealthMonitor();
const pythonProcessManager = new PythonProcessManager();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); 
app.use(apiLimiter); 

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

app.use("/api/users", userRoutes);
app.use("/api/anomalies", anomalyDetectionRoutes);
app.use("/api/notifications", notificationRoutes);

mongoose
  .connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,        
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    initializePushNotificationCleanup();
    startSystemMonitoring();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

const generateSensorData = (deviceId) => {
  const shouldBeNull = Math.random() < 0.05; 

  const deviceVariation = parseInt(deviceId) || 1;
  const timeVariation = Math.sin(Date.now() / 3600000) * 2; 

  const temperature = shouldBeNull ? null : 
    parseFloat((Math.random() * (35 - 20) + 20 + deviceVariation + timeVariation).toFixed(2));
  
  let humidity, co2, ec, ph;

  if (shouldBeNull) {
    humidity = null;
    co2 = null;
    ec = null;
    ph = null;
  } else {
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
    vpd = parseFloat(Math.max(0, saturationVaporPressure - actualVaporPressure).toFixed(2));
  }

  const baseVoltage = 3.3;
  const voltageVariation = shouldBeNull ? null : 
    parseFloat((baseVoltage + (Math.random() - 0.5) * 0.2).toFixed(2));
  
  const baseBattery = 85;
  const batteryDrain = Math.random() * 0.1; 
  const battery_level = shouldBeNull ? null : 
    Math.max(0, parseInt(baseBattery - batteryDrain, 10));

  return {
    temperature,
    humidity,
    co2,
    ec,
    ph,
    dew_point: dewPoint,
    vpd: vpd,
    voltage: voltageVariation,
    battery_level,
    timestamp: new Date().toISOString(),
  };
};

const sendDeviceStatusNotification = async (device, status, message) => {
  try {
    if (!device.userId) return;
    
    await pushNotificationService.sendDeviceAlert(
      device.userId,
      device.deviceId,
      device.name,
      status,
      message
    );
    
    console.log(`Device status notification sent for ${device.name}: ${status}`);
  } catch (error) {
    console.error(`Failed to send device status notification:`, error);
  }
};

const simulateSensorDataForAllDevices = async () => {
  try {
    console.log('Starting sensor data simulation...');
    const connectedDevices = await Device.find({ status: 'Connected' });
    
    if (connectedDevices.length === 0) {
      console.log('No connected devices found for simulation');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const device of connectedDevices) {
      try {
        const sensorData = generateSensorData(device.deviceId);
        
        const lastData = device.data[device.data.length - 1];
        const wasOffline = lastData && (lastData.temperature === null && lastData.humidity === null);
        const isNowOnline = sensorData.temperature !== null && sensorData.humidity !== null;
        
        device.data.push(sensorData);
        
        if (device.data.length > 1000) {
          device.data = device.data.slice(-1000);
        }
        
        await device.save();
        
        if (wasOffline && isNowOnline) {
          await sendDeviceStatusNotification(device, 'Online', 'Device is now online and sending data');
        }
        
        if (sensorData.battery_level && sensorData.battery_level < 20) {
          await sendDeviceStatusNotification(device, 'Low Battery', `Battery level is ${sensorData.battery_level}%`);
        }
        
        successCount++;
        
      } catch (deviceError) {
        errorCount++;
        console.error(`Error generating data for device ${device.deviceId}:`, deviceError.message);
      }
    }

    console.log(`Sensor data simulation completed: ${successCount} success, ${errorCount} errors`);

    systemHealthMonitor.metrics.total_anomalies_processed += successCount;
    systemHealthMonitor.metrics.error_count += errorCount;
    
  } catch (error) {
    console.error("Error in sensor data simulation:", error);
    systemHealthMonitor.metrics.error_count++;
  }
};

const startSystemMonitoring = () => {
  setInterval(() => {
    systemHealthMonitor.checkSystemHealth();
  }, 5 * 60 * 1000);

  console.log('System health monitoring started');
};

const initializePushNotificationCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('Starting daily push token cleanup...');
      await pushNotificationService.cleanupOldTokens(30);
      console.log('Push token cleanup completed');
    } catch (error) {
      console.error('Push token cleanup failed:', error);
    }
  });

  cron.schedule('0 3 * * 0', async () => {
    try {
      console.log('Starting weekly notification cleanup...');
      await pushNotificationService.cleanupOldNotifications(90);
      console.log('Notification cleanup completed');
    } catch (error) {
      console.error('Notification cleanup failed:', error);
    }
  });

  cron.schedule('*/30 * * * * *', async () => {
    try {
      await pushNotificationService.processDeliveryQueue();
    } catch (error) {
      console.error('Notification delivery processing failed:', error);
    }
  });

  console.log('Push notification cleanup jobs initialized');
};

const startSensorSimulation = () => {
  setTimeout(simulateSensorDataForAllDevices, 5000);
  
  setInterval(() => {
    const jitter = Math.random() * 60000; 
    setTimeout(simulateSensorDataForAllDevices, jitter);
  }, 3600000); 

  console.log('Sensor data simulation started');
};

const gracefulShutdown = async () => {
  console.log('Shutting down server gracefully...');
  
  try {
    await pythonProcessManager.gracefulShutdown();
    
    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    console.log('Server shutdown complete');
    process.exit(0);
    
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

app.get('/', (req, res) => {
  res.json({
    message: 'EMIB Backend Server with Enhanced Anomaly Detection',
    version: '2.0.0',
    status: 'running',
    features: [
      'Enhanced Anomaly Detection with ML + Rules',
      'Real-time Push Notifications',
      'System Health Monitoring',
      'Advanced Error Handling',
      'Input Validation & Security'
    ],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const health = await systemHealthMonitor.checkSystemHealth();
    const pythonStatus = pythonProcessManager.getStatus();
    
    res.status(health.error ? 500 : 200).json({
      status: health.error ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        anomaly_detection: pythonStatus.running ? 'running' : 'stopped',
        push_notifications: 'active'
      },
      metrics: health.metrics || {},
      python_process: pythonStatus,
      version: '2.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/device-templates", (req, res) => {
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
  
  res.status(200).json({ 
    message: "Available device templates",
    templates: deviceTemplates 
  });
});

app.use("/api/devices", require("./routes/deviceRoutes"));
app.use("/api/zones", require("./routes/zoneRoutes"));

app.post("/api/signup", strictLimiter, async (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ 
    success: false,
    message: error.details[0].message 
  });

  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ 
      success: false,
      message: "Email already exists" 
    });
    
    const newUser = new User({ email, password });
    await newUser.save();
    
    try {
      setTimeout(async () => {
        await pushNotificationService.sendToUser(
          newUser._id,
          'Welcome to EMIB!',
          'Your account has been created successfully. Start monitoring your devices now.',
          {
            type: 'welcome',
            userId: newUser._id
          },
          {
            type: 'system_update',
            priority: 'normal'
          }
        );
      }, 5000);
    } catch (pushError) {
      console.error('Failed to send welcome notification:', pushError);
    }
    
    res.status(201).json({ 
      success: true,
      message: "User created successfully!" 
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/signin", strictLimiter, async (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ 
    success: false,
    message: error.details[0].message 
  });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ 
      success: false,
      message: "User not found" 
    });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ 
      success: false,
      message: "Invalid password" 
    });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: "24h" });

    res.status(200).json({ 
      success: true,
      message: "Login successful", 
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/user/sensor-data', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, deviceId } = req.query;

    if (startDate && !Date.parse(startDate)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid startDate format' 
      });
    }
    
    if (endDate && !Date.parse(endDate)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid endDate format' 
      });
    }

    const deviceQuery = { userId };
    if (deviceId) {
      deviceQuery.deviceId = deviceId;
    }
    
    const device = await Device.findOne(deviceQuery);
    if (!device) {
      return res.status(404).json({ 
        success: false,
        message: 'No devices found' 
      });
    }

    let filteredData = device.data || [];

    if (startDate && endDate) {
      filteredData = device.data.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate + "T23:59:59");
      });

      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (daysDiff <= 2) {
        res.status(200).json({ 
          success: true,
          data: filteredData,
          device: {
            id: device.deviceId,
            name: device.name
          },
          period: `${daysDiff} day(s)`,
          dataPoints: filteredData.length
        });
      } else {
        const dailyData = {};
        filteredData.forEach(item => {
          const date = new Date(item.timestamp).toISOString().split("T")[0];
          if (!dailyData[date]) {
            dailyData[date] = {
              temperature: { sum: 0, count: 0 },
              humidity: { sum: 0, count: 0 },
              dew_point: { sum: 0, count: 0 },
              vpd: { sum: 0, count: 0 },
              voltage: { sum: 0, count: 0 },
              battery_level: { sum: 0, count: 0 },
              timestamp: item.timestamp,
            };
          }
          
          ['temperature', 'humidity', 'dew_point', 'vpd', 'voltage', 'battery_level'].forEach(field => {
            if (item[field] !== null && item[field] !== undefined) {
              dailyData[date][field].sum += item[field];
              dailyData[date][field].count += 1;
            }
          });
          
          if (new Date(item.timestamp) > new Date(dailyData[date].timestamp)) {
            dailyData[date].timestamp = item.timestamp;
          }
        });

        const averagedData = Object.keys(dailyData).map(date => {
          const dayData = dailyData[date];
          const result = { timestamp: dayData.timestamp };
          
          ['temperature', 'humidity', 'dew_point', 'vpd', 'voltage', 'battery_level'].forEach(field => {
            result[field] = dayData[field].count > 0 
              ? parseFloat((dayData[field].sum / dayData[field].count).toFixed(2))
              : null;
          });
          
          return result;
        });

        res.status(200).json({ 
          success: true,
          data: averagedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
          device: {
            id: device.deviceId,
            name: device.name
          },
          period: `${daysDiff} day(s) (daily averages)`,
          dataPoints: averagedData.length
        });
      }
    } else {
      const recentData = filteredData.slice(-100);
      res.status(200).json({ 
        success: true,
        data: recentData,
        device: {
          id: device.deviceId,
          name: device.name
        },
        period: 'Recent data',
        dataPoints: recentData.length
      });
    }
  } catch (err) {
    next(err);
  }
});

const enhancedErrorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry found'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

app.use(enhancedErrorHandler);

const createTestUser = async () => {
  try {
    const testEmail = "test@example.com";
    let user = await User.findOne({ email: testEmail });
    if (!user) {
      user = new User({
        email: testEmail,
        password: await bcrypt.hash("password123", 10),
      });
      await user.save();
      console.log("Created test user:", testEmail);
    }
    return user._id;
  } catch (error) {
    console.error("Error creating test user:", error);
    throw error;
  }
};

const initializeServer = async () => {
  try {
    console.log('Initializing Enhanced EMIB Server...');
    
    await createTestUser();
    
    startSensorSimulation();
    
    setTimeout(() => {
      pythonProcessManager.start();
      console.log('Python Anomaly Detection Service enabled');
    }, 10000);
    
    try {
      const deliveryStats = await pushNotificationService.getDeliveryStats(1);
      console.log('Push Notification Service initialized');
      console.log('Last 24h delivery stats:', deliveryStats);
    } catch (error) {
      console.error('Push Notification Service warning:', error.message);
    }

    console.log("All services initialized successfully");
  } catch (error) {
    console.error("Server initialization error:", error);
    process.exit(1);
  }
};

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`Enhanced EMIB Server running on http://localhost:${PORT}`);
    console.log(`Push Notifications: Available`);
    console.log(`Anomaly Detection: Enhanced ML + Rules`);
    console.log(`Security: Input validation, Rate limiting, Error handling`);
    console.log(`Health Monitoring: Active`);
    console.log(`Available endpoints:`);
    console.log(`   - GET /api/health - Enhanced system health check`);
    console.log(`   - GET /api/notifications/health - Push notification health`);
    console.log(`   - POST /api/notifications/register-token - Register device`);
    console.log(`   - POST /api/notifications/test - Send test notification`);
    console.log(`   - GET /api/device-templates - Available device templates`);
    
    initializeServer();
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
    gracefulShutdown();
  });
  
  return server;
};

startServer();