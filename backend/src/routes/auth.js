const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── Register ────────────────────────────────────────────────────────────────
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role = 'user' } = req.body;

    try {
      // Check existing user
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = uuidv4();

      await pool.query(
        'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [userId, email, passwordHash, role]
      );

      // Log activity
      await pool.query(
        'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
        [userId, 'register', JSON.stringify({ email, role })]
      );

      logger.info(`New user registered: ${email} (${role})`);

      const accessToken = signAccessToken({ id: userId, email, role });
      const refreshToken = signRefreshToken({ id: userId, email });

      res.status(201).json({
        message: 'Account created successfully',
        user: { id: userId, email, role },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      logger.error(`Register error: ${err.message}`);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ─── Login ────────────────────────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query(
        'SELECT id, email, password_hash, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        logger.warn(`Failed login attempt for: ${email}`);
        await pool.query(
          'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
          [user.id, 'login_failed', JSON.stringify({ email })]
        );
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      await pool.query(
        'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
        [user.id, 'login_success', JSON.stringify({ email })]
      );

      logger.info(`User logged in: ${email}`);

      const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
      const refreshToken = signRefreshToken({ id: user.id, email: user.email });

      res.json({
        message: 'Login successful',
        user: { id: user.id, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      logger.error(`Login error: ${err.message}`);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ─── Refresh Token ────────────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const accessToken = signAccessToken({ id: decoded.id, email: decoded.email, role: decoded.role });
    res.json({ accessToken });
  } catch {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// ─── Get Profile ──────────────────────────────────────────────────────────────
router.get('/me', require('../middleware/authMiddleware').authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

module.exports = router;
