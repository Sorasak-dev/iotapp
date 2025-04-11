const express = require("express");
const Device = require("../models/Device");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");
const router = express.Router();

// ✅ 1. บันทึกอุปกรณ์ที่เชื่อมต่อ (รองรับการอัปเดต และเพิ่มใน User)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, type, image, deviceId, location, zoneId } = req.body;
    
    // หา User ที่ล็อกอินอยู่
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ตรวจสอบว่ามี zone ที่ระบุหรือไม่
    let validZoneId = null;
    if (zoneId) {
      const zoneExists = user.zones.some(zone => zone._id.toString() === zoneId);
      if (zoneExists) {
        validZoneId = zoneId;
      }
    } else if (user.currentZoneId) {
      // ถ้าไม่ระบุ zoneId แต่มี currentZoneId ให้ใช้ currentZoneId
      validZoneId = user.currentZoneId;
    }

    // ตรวจสอบว่ามีอุปกรณ์นี้อยู่แล้วหรือไม่
    let device = await Device.findOne({ userId: req.user.id, deviceId });

    if (device) {
      // ✅ ถ้ามีอุปกรณ์แล้ว → อัปเดตข้อมูล
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
      // ✅ ถ้ายังไม่มี → เพิ่มอุปกรณ์ใหม่
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
      
      // ✅ เพิ่มอุปกรณ์เข้าไปใน user.devices
      user.devices.push(device._id);
      await user.save();
    }

    return res.status(201).json({ message: "Device Connected", device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ 2. ดึงอุปกรณ์ที่เชื่อมต่อของ User (ต้องมี Token)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.query;
    
    let query = { userId: req.user.id };
    
    // ถ้ามีการระบุ zoneId ให้กรองตาม zoneId
    if (zoneId) {
      query.zoneId = zoneId;
    } else {
      // ถ้าไม่ระบุ zoneId ให้ดึงอุปกรณ์ทั้งหมด
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

// ✅ 3. ลบอุปกรณ์ที่เชื่อมต่อ (ต้องมี Token)
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

    // ✅ เอา Device ออกจาก user.devices
    user.devices = user.devices.filter((id) => id.toString() !== req.params.deviceId);
    await user.save();

    res.json({ message: "Device removed successfully", device: deletedDevice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ 4. อัปเดตตำแหน่งของอุปกรณ์
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

// ✅ 5. อัปเดต zone ของอุปกรณ์
router.patch("/:deviceId/zone", authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.body;
    
    if (!zoneId) {
      return res.status(400).json({ message: "Zone ID is required" });
    }

    // ตรวจสอบว่ามี zone ที่ระบุหรือไม่
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

module.exports = router;