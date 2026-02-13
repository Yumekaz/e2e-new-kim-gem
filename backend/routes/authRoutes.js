/**
 * Authentication Routes
 * /api/auth/*
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', authRateLimiter, authController.register.bind(authController));
router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/refresh', authRateLimiter, authController.refresh.bind(authController));
router.post('/logout', authRateLimiter, authController.logout.bind(authController));

// Protected routes
router.post('/logout-all', authenticateToken, authController.logoutAll.bind(authController));
router.get('/me', authenticateToken, authController.me.bind(authController));

module.exports = router;
