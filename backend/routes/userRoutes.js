const express = require('express');

// สมมติว่าตอนนี้คุณใช้ userController (ไม่มี s) ตามที่ผมแนะนำครั้งที่แล้ว
const { getUser, addUserData, getUserData, changePassword } = require('../controllers/userController'); 
const authenticateToken = require('../middleware/authMiddleware');

// ======================= DEBUG ZONE =======================
// เพิ่มโค้ดส่วนนี้เข้าไปเพื่อตรวจสอบค่าที่ import เข้ามา
console.log('--- Checking Imports ---');
console.log('getUser function is:', getUser);
console.log('addUserData function is:', addUserData);
console.log('getUserData function is:', getUserData);
console.log('changePassword function is:', changePassword);
console.log('authenticateToken function is:', authenticateToken);
console.log('------------------------');
// ==========================================================

const router = express.Router();

// ... โค้ดส่วนที่เหลือเหมือนเดิม
router.get('/', authenticateToken, getUser);

router.post('/data', authenticateToken, addUserData);

router.get('/data', authenticateToken, getUserData);

router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;