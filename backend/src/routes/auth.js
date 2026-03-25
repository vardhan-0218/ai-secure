const express = require('express');
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
    body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  ],
  authController.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  authController.login
);

router.post('/refresh', authController.refreshToken);

router.get('/me', authMiddleware, authController.getProfile);

router.post(
  '/forgot-password',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  ],
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
  ],
  authController.resetPassword
);

module.exports = router;
