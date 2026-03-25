const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

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

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// ─── Controllers ──────────────────────────────────────────────────────────────

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', { errors: errors.array() });
  }

  const { email, password, role: requestedRole = 'user' } = req.body;
  const role = requestedRole;

  if (role === 'admin' && process.env.ALLOW_ADMIN_SIGNUP !== 'true') {
    return sendError(res, 403, 'Admin signup is disabled');
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return sendError(res, 409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [userId, email, passwordHash, role]
    );

    await pool.query(
      'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
      [userId, 'register', JSON.stringify({ email, role })]
    );

    logger.info(`New user registered: ${email} (${role})`);

    const accessToken = signAccessToken({ id: userId, email, role });
    const refreshToken = signRefreshToken({ id: userId, email });

    return sendSuccess(res, {
      message: 'Account created successfully',
      user: { id: userId, email, role },
      accessToken,
      refreshToken,
    }, 201);
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    return sendError(res, 500, 'Registration failed');
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', { errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      logger.warn(`Failed login attempt for: ${email}`);
      await pool.query(
        'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
        [user.id, 'login_failed', JSON.stringify({ email })]
      );
      return sendError(res, 401, 'Invalid email or password');
    }

    await pool.query(
      'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1, $2, $3)',
      [user.id, 'login_success', JSON.stringify({ email })]
    );

    logger.info(`User logged in: ${email}`);

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });

    return sendSuccess(res, {
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    return sendError(res, 500, 'Login failed');
  }
};

const refreshToken = (req, res) => {
  const { refreshToken: rToken } = req.body;
  if (!rToken) return sendError(res, 401, 'Refresh token required');

  try {
    const decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET);
    const accessToken = signAccessToken({ id: decoded.id, email: decoded.email, role: decoded.role });
    return sendSuccess(res, { accessToken });
  } catch {
    return sendError(res, 403, 'Invalid or expired refresh token');
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return sendError(res, 404, 'User not found');
    return sendSuccess(res, { user: result.rows[0] });
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch profile');
  }
};

const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', { errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const userResult = await pool.query('SELECT id, email FROM users WHERE email=$1', [email]);
    const generic = 'If an account exists for this email, recovery instructions will be sent.';

    if (userResult.rows.length === 0) {
      return sendSuccess(res, { message: generic });
    }

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, email, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), user.id, email, tokenHash, expiresAt]
    );

    const message = generic;
    const resetToken = process.env.NODE_ENV === 'production' ? undefined : token;

    await pool.query(
      'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1,$2,$3)',
      [user.id, 'password_reset_requested', JSON.stringify({ email, expiresAt })]
    );

    return sendSuccess(res, { message, resetToken });
  } catch (err) {
    logger.error(`Forgot password error: ${err.message}`);
    return sendError(res, 500, 'Recovery request failed');
  }
};

const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', { errors: errors.array() });
  }

  const { token, newPassword } = req.body;

  try {
    const tokenHash = hashToken(token);

    const tokenResult = await pool.query(
      `SELECT id, user_id, token_hash, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return sendError(res, 400, 'Invalid or expired reset token');
    }

    const row = tokenResult.rows[0];
    if (row.used_at) return sendError(res, 400, 'Invalid or expired reset token');
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return sendError(res, 400, 'Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2',
      [passwordHash, row.user_id]
    );

    await pool.query(
      `UPDATE password_reset_tokens
       SET used_at=NOW()
       WHERE id=$1`,
      [row.id]
    );

    await pool.query(
      'INSERT INTO activity_log (user_id, action, metadata) VALUES ($1,$2,$3)',
      [row.user_id, 'password_reset_completed', JSON.stringify({ tokenUsedAt: new Date().toISOString() })]
    );

    return sendSuccess(res, { message: 'Password updated successfully' });
  } catch (err) {
    logger.error(`Reset password error: ${err.message}`);
    return sendError(res, 500, 'Reset password failed');
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  forgotPassword,
  resetPassword
};
