const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { getUsers, getAnalysisSessions, getAnalytics, getAlerts, removeUser } = require('../controllers/adminController');

const router = express.Router();

router.get('/users', authMiddleware, adminMiddleware, getUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, removeUser);
router.get('/analysis-sessions', authMiddleware, adminMiddleware, getAnalysisSessions);
router.get('/analytics', authMiddleware, adminMiddleware, getAnalytics);
router.get('/alerts', authMiddleware, adminMiddleware, getAlerts);

module.exports = router;
