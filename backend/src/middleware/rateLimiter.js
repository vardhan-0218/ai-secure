const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes',
    retryAfter: '15 minutes',
  },
});

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.ANALYZE_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Analysis rate limit exceeded. Maximum 20 analyses per 15 minutes.',
    retryAfter: '15 minutes',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

module.exports = { globalLimiter, analyzeLimiter, authLimiter };
