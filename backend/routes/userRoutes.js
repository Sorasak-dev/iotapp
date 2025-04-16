const express = require('express');
const { getUser, addUserData, getUserData, changePassword } = require('../controllers/userControllers'); // Fix the import path
const authenticateToken = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', authenticateToken, getUser);

router.post('/data', authenticateToken, addUserData);

router.get('/data', authenticateToken, getUserData);

router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;