const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

// ✅ UPDATED: ดึงข้อมูลผู้ใช้งานที่ครบถ้วน
exports.getUser = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token is missing' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.id).select('-password'); // ไม่ส่งรหัสผ่านกลับไป
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json(user); // ส่งข้อมูลผู้ใช้ทั้งหมดกลับไป
  } catch (err) {
    console.error('❌ Error fetching user data:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ NEW: ฟังก์ชันสำหรับอัปเดตข้อมูลโปรไฟล์
exports.updateUserProfile = async (req, res) => {
  const { id } = req.user; // id ที่ได้จาก authMiddleware
  const { name, username, phone, gender, profileImageUrl } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // อัปเดตข้อมูลตามที่ส่งมา
    if (name !== undefined) user.name = name;
    if (username !== undefined) {
      // ตรวจสอบว่า username ซ้ำกับคนอื่นหรือไม่ (ถ้ามีการเปลี่ยนแปลง)
      if (username !== user.username) {
        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
          return res.status(409).json({ message: 'Username is already taken' });
        }
        user.username = username;
      }
    }
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl;

    await user.save();
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.addUserData = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token is missing' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newData = req.body.newData;
    if (!newData || !newData.sensorId || !newData.timestamp) {
      return res.status(400).json({ message: 'Invalid or missing data' });
    }

    const isDuplicate = user.data.some(
      (item) => item.sensorId === newData.sensorId && item.timestamp === newData.timestamp
    );

    if (isDuplicate) {
      return res.status(409).json({ message: 'Duplicate data entry detected' });
    }

    user.data.push(newData);
    await user.save();
    res.status(200).json({ message: 'Data added successfully', data: user.data });
  } catch (err) {
    console.error('❌ Error adding user data:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getUserData = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token is missing' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ data: user.data });
  } catch (err) {
    console.error('❌ Error fetching user data:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

exports.changePassword = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token is missing' });

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Old and new passwords are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user._skipHashing = true;

    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('❌ Error changing password:', err.message);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};
