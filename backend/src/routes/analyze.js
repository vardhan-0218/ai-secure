const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { analyzeLimiter } = require('../middleware/rateLimiter');
const { upload } = require('../middleware/uploadMiddleware');
const { handleAnalyze, getAnalysisHistory, getAnalysisSession } = require('../controllers/analyzeController');

const router = express.Router();

router.post('/', authMiddleware, analyzeLimiter, upload.single('file'), handleAnalyze);
router.get('/history', authMiddleware, getAnalysisHistory);
router.get('/:sessionId', authMiddleware, getAnalysisSession);

module.exports = router;
