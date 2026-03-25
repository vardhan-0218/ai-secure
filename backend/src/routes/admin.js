const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { getUsers, getAnalysisSessions, getAnalytics, getAlerts } = require('../controllers/adminController');

const router = express.Router();

router.get('/users', authMiddleware, adminMiddleware, getUsers);
router.get('/analysis-sessions', authMiddleware, adminMiddleware, getAnalysisSessions);
router.get('/analytics', authMiddleware, adminMiddleware, getAnalytics);
router.get('/alerts', authMiddleware, adminMiddleware, getAlerts);

module.exports = router;
