const User = require('../models/User');
const Device = require('../models/Device');
const mongoose = require('mongoose');

exports.createZone = async (req, res) => {
  try {
    const { name, location, image } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: 'Zone name is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newZone = {
      name,
      location: location || { address: "" },
      image: image || null,
      isDefault: user.zones.length === 0
    };

    user.zones.push(newZone);

    if (!user.currentZoneId) {
      user.currentZoneId = user.zones[user.zones.length - 1]._id;
    }

    await user.save();

    res.status(201).json({ 
      message: 'Zone created successfully', 
      zone: user.zones[user.zones.length - 1] 
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getZones = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.zones.length === 0) {
      await user.createDefaultZone();
    }

    res.status(200).json({ 
      zones: user.zones,
      currentZoneId: user.currentZoneId
    });
  } catch (error) {
    console.error('Error getting zones:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, location, image } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const zoneIndex = user.zones.findIndex(zone => zone._id.toString() === zoneId);
    if (zoneIndex === -1) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    if (name) user.zones[zoneIndex].name = name;
    if (location) user.zones[zoneIndex].location = location;
    if (image) user.zones[zoneIndex].image = image;

    await user.save();

    res.status(200).json({ 
      message: 'Zone updated successfully', 
      zone: user.zones[zoneIndex] 
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.zones.length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only zone' });
    }

    const zoneIndex = user.zones.findIndex(zone => zone._id.toString() === zoneId);
    if (zoneIndex === -1) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    const isCurrentZone = user.currentZoneId && user.currentZoneId.toString() === zoneId;

    const deletedZone = user.zones.splice(zoneIndex, 1)[0];

    if (isCurrentZone && user.zones.length > 0) {
      user.currentZoneId = user.zones[0]._id;
    }

    await Device.updateMany(
      { userId, zoneId: new mongoose.Types.ObjectId(zoneId) },
      { $set: { zoneId: null } }
    );

    await user.save();

    res.status(200).json({ 
      message: 'Zone deleted successfully',
      currentZoneId: user.currentZoneId
    });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.switchCurrentZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const zoneExists = user.zones.some(zone => zone._id.toString() === zoneId);
    if (!zoneExists) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    user.currentZoneId = zoneId;
    await user.save();

    const currentZone = user.zones.find(zone => zone._id.toString() === zoneId);

    const devices = await Device.find({ 
      userId, 
      $or: [
        { zoneId: new mongoose.Types.ObjectId(zoneId) },
        { zoneId: null }
      ]
    });

    res.status(200).json({ 
      message: 'Switched to selected zone', 
      currentZone,
      devices
    });
  } catch (error) {
    console.error('Error switching zone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.addDeviceToZone = async (req, res) => {
  try {
    const { zoneId, deviceId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const zoneExists = user.zones.some(zone => zone._id.toString() === zoneId);
    if (!zoneExists) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    device.zoneId = new mongoose.Types.ObjectId(zoneId);
    await device.save();

    res.status(200).json({ 
      message: 'Device added to zone successfully',
      device
    });
  } catch (error) {
    console.error('Error adding device to zone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
