const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getAlerts, markAlertRead, markAllAlertsRead, getAlertStats } = require('../controllers/alertsController');

const router = express.Router();

router.get('/', authMiddleware, getAlerts);
router.patch('/read-all', authMiddleware, markAllAlertsRead);
router.patch('/:id/read', authMiddleware, markAlertRead);
router.get('/stats', authMiddleware, getAlertStats);

module.exports = router;
