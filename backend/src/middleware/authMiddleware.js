const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Access denied. No token provided.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`Invalid token attempt: ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Token expired. Please log in again.');
    }
    return sendError(res, 403, 'Invalid token.');
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required.');
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
