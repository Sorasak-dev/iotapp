const express = require("express");
const Device = require("../models/Device");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, type, image, deviceId, location, zoneId } = req.body;
    
    const user = await User.findById(req.user.id);
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

    let device = await Device.findOne({ userId: req.user.id, deviceId });

    if (device) {
      device.status = "Connected";
      device.image = image;
      device.updatedAt = new Date();
      if (location) {
        device.location = location;
      }
      if (validZoneId) {
        device.zoneId = validZoneId;
      }
      await device.save();
    } else {
      device = new Device({ 
        userId: req.user.id, 
        name, 
        type, 
        image, 
        deviceId, 
        location: location || {},
        zoneId: validZoneId
      });
      await device.save();
      
      user.devices.push(device._id);
      await user.save();
    }

    return res.status(201).json({ message: "Device Connected", device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.query;
    
    let query = { userId: req.user.id };

    if (zoneId) {
      query.zoneId = zoneId;
    } else {
      const user = await User.findById(req.user.id);
      if (user && user.currentZoneId) {
        query.zoneId = user.currentZoneId;
      }
    }
    
    const devices = await Device.find(query);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:deviceId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const deletedDevice = await Device.findOneAndDelete({
      _id: req.params.deviceId,
      userId: req.user.id, 
    });

    if (!deletedDevice) {
      return res.status(404).json({ message: "Device not found" });
    }

    user.devices = user.devices.filter((id) => id.toString() !== req.params.deviceId);
    await user.save();

    res.json({ message: "Device removed successfully", device: deletedDevice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:deviceId/location", authenticateToken, async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ message: "Location data is required" });
    }

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
    res.status(500).json({ error: error.message });
  }
});

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
    res.status(500).json({ error: error.message });
  }
});

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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;