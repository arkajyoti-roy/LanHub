const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { getUserHistory } = require('../controllers/historyController');

// Public Routes
router.post('/auth/login', userController.login);

// Protected User Routes
router.post('/auth/change-password', verifyToken, userController.changePassword);
// Protected Admin Routes
router.get('/users', verifyToken, verifyAdmin, userController.getAllUsers);
router.post('/users', verifyToken, verifyAdmin, userController.createUser);
router.delete('/users/:id', verifyToken, verifyAdmin, userController.deleteUser);
router.get('/history', verifyToken, getUserHistory);
module.exports = router;