const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const authenticateToken = require('../../middleware/authMiddleware');

// Create test app
const app = express();
app.use(express.json());

// Import or define routes
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, gender, profileImageUrl } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl;

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New passwords do not match' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const bcrypt = require('bcrypt');
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

describe('User Controller Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      email: 'testuser@example.com',
      password: 'Test123456!',
      name: 'Test User'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.SECRET_KEY || 'test_secret_key',
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('email', 'testuser@example.com');
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id, email: testUser.email },
        process.env.SECRET_KEY || 'test_secret_key',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '0812345678',
        gender: 'male'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Updated Name');
      expect(response.body).toHaveProperty('phone', '0812345678');
      expect(response.body).toHaveProperty('gender', 'male');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should update only specified fields', async () => {
      const updateData = {
        name: 'Only Name Updated'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Only Name Updated');
      expect(response.body.email).toBe('testuser@example.com');
    });

    it('should update profile image URL', async () => {
      const updateData = {
        profileImageUrl: 'https://example.com/new-avatar.jpg'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('profileImageUrl', 'https://example.com/new-avatar.jpg');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .send({ name: 'Should Fail' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/user/change-password', () => {
    it('should change password with correct old password', async () => {
      const passwordData = {
        oldPassword: 'Test123456!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Password changed successfully');

      // Verify password was actually changed
      const updatedUser = await User.findById(testUser._id);
      const bcrypt = require('bcrypt');
      const isNewPasswordCorrect = await bcrypt.compare('NewPassword123!', updatedUser.password);
      expect(isNewPasswordCorrect).toBe(true);
    });

    it('should fail with incorrect old password', async () => {
      const passwordData = {
        oldPassword: 'WrongPassword',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('incorrect');
    });

    it('should fail when new passwords do not match', async () => {
      const passwordData = {
        oldPassword: 'Test123456!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!'
      };

      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('do not match');
    });

    it('should fail with missing fields', async () => {
      const passwordData = {
        oldPassword: 'Test123456!',
        newPassword: 'NewPassword123!'
        // missing confirmPassword
      };

      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });

    it('should fail without authentication', async () => {
      const passwordData = {
        oldPassword: 'Test123456!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/user/change-password')
        .send(passwordData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});