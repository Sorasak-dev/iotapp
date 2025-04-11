const express = require('express');
const { getUser, addUserData, getUserData } = require('../backend/controllers/userController');
const authenticateToken = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/', authenticateToken, getUser);

router.post('/data', authenticateToken, addUserData);

router.get('/data', authenticateToken, getUserData);

module.exports = router;