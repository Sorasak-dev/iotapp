const express = require('express');

const { getUser, addUserData, getUserData, changePassword } = require('../controllers/userController'); 
const authenticateToken = require('../middleware/authMiddleware');

// ======================= DEBUG ZONE =======================
// Debugging imports to ensure they are correctly imported
console.log('--- Checking Imports ---');
console.log('getUser function is:', getUser);
console.log('addUserData function is:', addUserData);
console.log('getUserData function is:', getUserData);
console.log('changePassword function is:', changePassword);
console.log('authenticateToken function is:', authenticateToken);
console.log('------------------------');
// ==========================================================

const router = express.Router();

router.get('/', authenticateToken, getUser);

router.post('/data', authenticateToken, addUserData);

router.get('/data', authenticateToken, getUserData);

router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;