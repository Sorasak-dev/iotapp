const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const authenticateToken = require('../middleware/authMiddleware');
const { zoneValidationSchema } = require('../validation/zoneValidation');

const validateZoneData = (req, res, next) => {
  const { error } = zoneValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

router.post('/', authenticateToken, validateZoneData, zoneController.createZone);

router.get('/', authenticateToken, zoneController.getZones);

router.put('/:zoneId', authenticateToken, zoneController.updateZone);

router.delete('/:zoneId', authenticateToken, zoneController.deleteZone);

router.post('/:zoneId/switch', authenticateToken, zoneController.switchCurrentZone);

router.post('/:zoneId/devices/:deviceId', authenticateToken, zoneController.addDeviceToZone);

module.exports = router;