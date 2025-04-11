const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const authenticateToken = require('../middleware/authMiddleware');
const { zoneValidationSchema } = require('../validation/zoneValidation');

// สร้าง middleware ตรวจสอบความถูกต้องของข้อมูล zone
const validateZoneData = (req, res, next) => {
  const { error } = zoneValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

// สร้าง zone ใหม่
router.post('/', authenticateToken, validateZoneData, zoneController.createZone);

// ดึงข้อมูล zone ทั้งหมดของผู้ใช้
router.get('/', authenticateToken, zoneController.getZones);

// อัปเดต zone ที่ระบุ
router.put('/:zoneId', authenticateToken, zoneController.updateZone);

// ลบ zone ที่ระบุ
router.delete('/:zoneId', authenticateToken, zoneController.deleteZone);

// เปลี่ยน zone ที่กำลังใช้งาน
router.post('/:zoneId/switch', authenticateToken, zoneController.switchCurrentZone);

// เพิ่มอุปกรณ์เข้า zone
router.post('/:zoneId/devices/:deviceId', authenticateToken, zoneController.addDeviceToZone);

module.exports = router;