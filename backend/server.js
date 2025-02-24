const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = require("./middleware/authMiddleware");
const errorHandler = require("./middleware/errorHandler");
const { userValidationSchema, userDataValidationSchema } = require("./validation/userValidation");
const User = require("./models/User");
const Device = require("./models/Device"); 

const app = express();

// Environment variables
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/auth-demo";
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Simulate Sensor Data
const generateMockSensorData = () => {
  const shouldBeNull = Math.random() < 0.1; 
  const randomValue = (min, max) => 
    parseFloat((Math.random() * (max - min) + min).toFixed(2)); 
  
  return {
    sensorId: 'AM2315',
    temperature: shouldBeNull ? null : randomValue(20, 40), 
    humidity: shouldBeNull ? null : randomValue(30, 70),    
    timestamp: new Date().toISOString(),                  
  };
};

const simulateSensorData = async () => {
  const users = await User.find();
  if (users.length === 0) {
    console.error('❌ No users found for adding sensor data.');
    return;
  }

  for (const user of users) {
    const mockData = generateMockSensorData();

    const isDuplicate = user.data.some(
      (item) => item.sensorId === mockData.sensorId && item.timestamp === mockData.timestamp
    );

    if (!isDuplicate) {
      user.data.push(mockData);
      await user.save();
      console.log(`✅ Mock sensor data added for ${user.email}:`, mockData);
    } else {
      console.log(`ℹ️ Duplicate sensor data detected for ${user.email}, skipping.`);
    }
  }
};

// Run the simulation every 1 hr
setInterval(simulateSensorData, 3600000);

// Routes
app.get('/', (req, res) => {
  res.send('Hello! Backend Server is running. 🚀');
});

// ✅ เชื่อม API อุปกรณ์เข้า Server
app.use("/api/devices", require("./routes/deviceRoutes"));

// ✅ Sign Up
app.post("/api/signup", async (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });

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

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    next(err);
  }
});

// Add Sensor Data
app.post('/api/user/sensor-data', authenticateToken, async (req, res, next) => {
  const { error } = userDataValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newData = req.body.newData;

    const isDuplicate = user.data.some(
      (item) => item.sensorId === newData.sensorId && item.timestamp === newData.timestamp
    );

    if (isDuplicate) {
      return res.status(409).json({ message: 'Duplicate data entry detected' });
    }

    user.data.push(newData);
    await user.save();

    res.status(200).json({ message: 'Sensor data added successfully!', data: user.data });
  } catch (err) {
    next(err);
  }
});

// Get Sensor Data
app.get('/api/user/sensor-data', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ data: user.data });
  } catch (err) {
    next(err);
  }
});


// Global Error Handling Middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
