const express = require("express");
const Device = require("../models/Device");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");
const { deviceValidationSchema, locationValidationSchema } = require("../validation/userValidation");
const router = express.Router();

// Available Device Templates
const deviceTemplates = [
  {
    id: "1",
    name: "E-MIB1",
    type: "Temperature & Humidity Sensor",
    image: "https://example.com/images/sensor.png",
    description: "Advanced environmental monitoring sensor"
  },
  {
    id: "2", 
    name: "E-MIB2",
    type: "Temperature & Humidity Sensor",
    image: "https://example.com/images/sensor2.png",
    description: "Precision climate monitoring device"
  },
  {
    id: "3",
    name: "E-MIB3", 
    type: "Temperature & Humidity Sensor",
    image: "https://example.com/images/sensor3.png",
    description: "Industrial grade environmental sensor"
  },
  {
    id: "4",
    name: "E-MIB4",
    type: "Temperature & Humidity Sensor", 
    image: "https://example.com/images/sensor4.png",
    description: "Smart wireless monitoring sensor"
  }
];

// Generate sensor data with device-specific variations
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

  return {
    temperature,
    humidity,
    co2,
    ec,
    ph,
    dew_point: dewPoint,
    vpd: vpd,
    timestamp: new Date().toISOString(),
  };
};

// Initialize historical data for new devices
const initializeHistoricalData = async (device) => {
  const now = new Date();
  const daysBack = 30;
  const intervalHours = 4;
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

// GET: Get available device templates
router.get("/templates", (req, res) => {
  res.status(200).json({ 
    message: "Available device templates",
    templates: deviceTemplates 
  });
});

// POST: Connect/Add a new device
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, type, image, deviceId, location, zoneId } = req.body;
    const userId = req.user.id;

    // Check if device template exists
    const template = deviceTemplates.find(t => t.id === deviceId);
    if (!template) {
      return res.status(400).json({ message: "Invalid device template" });
    }

    // Check if device already connected by this user
    const existingDevice = await Device.findOne({ 
      deviceId: deviceId,
      userId: userId 
    });

    if (existingDevice) {
      return res.status(409).json({ message: "Device already connected" });
    }

    // Get user and determine zone
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let validZoneId = null;
    if (zoneId) {
      const zoneExists = user.zones.some(zone => zone._id.toString() === zoneId);
      if (zoneExists) {
        validZoneId = zoneId;
      }
    } else if (user.currentZoneId) {
      validZoneId = user.currentZoneId;
    }

    // Create new device
    const newDevice = new Device({
      userId: userId,
      name: name || template.name,
      type: type || template.type,
      image: image || template.image,
      status: 'Connected',
      deviceId: deviceId,
      location: location || {},
      zoneId: validZoneId,
      data: []
    });

    await newDevice.save();

    // Add device to user's devices array
    user.devices.push(newDevice._id);
    await user.save();

    // Initialize with historical data
    await initializeHistoricalData(newDevice);

    res.status(201).json({ 
      message: "Device connected successfully!",
      device: newDevice 
    });

  } catch (error) {
    console.error("❌ Error connecting device:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get user's connected devices
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.query;
    const userId = req.user.id;
    
    let query = { userId };

    if (zoneId) {
      query.zoneId = zoneId;
    } else {
      const user = await User.findById(userId);
      if (user && user.currentZoneId) {
        query.zoneId = user.currentZoneId;
      }
    }
    
    const devices = await Device.find(query).select('-data');
    
    // Add summary info for each device
    const devicesWithSummary = await Promise.all(devices.map(async (device) => {
      const fullDevice = await Device.findById(device._id);
      const dataCount = fullDevice.data.length;
      const lastReading = dataCount > 0 ? fullDevice.data[dataCount - 1] : null;
      
      return {
        ...device.toObject(),
        dataCount,
        lastReading: lastReading ? {
          temperature: lastReading.temperature,
          humidity: lastReading.humidity,
          timestamp: lastReading.timestamp
        } : null,
        battery: "85%", // Mock battery data
        status: "Online" // Mock status
      };
    }));

    res.json(devicesWithSummary);
  } catch (error) {
    console.error("❌ Error fetching devices:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get specific device data
router.get("/:deviceId/data", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    const userId = req.user.id;

    const device = await Device.findOne({ 
      _id: deviceId,
      userId: userId 
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    let filteredData = device.data;

    // Filter by date range if provided
    if (startDate && endDate) {
      filteredData = device.data.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate + "T23:59:59");
      });
    }

    // Sort by timestamp (newest first) and limit results
    filteredData = filteredData
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.status(200).json({ 
      device: {
        _id: device._id,
        name: device.name,
        type: device.type,
        status: device.status
      },
      data: filteredData,
      totalRecords: device.data.length
    });

  } catch (error) {
    console.error("❌ Error fetching device data:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Disconnect a device
router.delete("/:deviceId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const deletedDevice = await Device.findOneAndDelete({
      _id: req.params.deviceId,
      userId: userId, 
    });

    if (!deletedDevice) {
      return res.status(404).json({ message: "Device not found" });
    }

    // Remove device from user's devices array
    user.devices = user.devices.filter((id) => id.toString() !== req.params.deviceId);
    await user.save();

    res.json({ message: "Device removed successfully", device: deletedDevice });
  } catch (error) {
    console.error("❌ Error deleting device:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update device location
router.patch("/:deviceId/location", authenticateToken, async (req, res) => {
  try {
    const { error } = locationValidationSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { location } = req.body;
    
    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, userId: req.user.id },
      { $set: { location } },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ message: "Location updated successfully", device });
  } catch (error) {
    console.error("❌ Error updating device location:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update device zone
router.patch("/:deviceId/zone", authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.body;
    
    if (!zoneId) {
      return res.status(400).json({ message: "Zone ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const zoneExists = user.zones.some(zone => zone._id.toString() === zoneId);
    if (!zoneExists) {
      return res.status(404).json({ message: "Zone not found" });
    }

    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, userId: req.user.id },
      { $set: { zoneId } },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ message: "Device zone updated successfully", device });
  } catch (error) {
    console.error("❌ Error updating device zone:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update device name
router.patch("/:deviceId", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, userId: req.user.id },
      { $set: { name } },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ message: "Device updated successfully", device });
  } catch (error) {
    console.error("❌ Error updating device:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;