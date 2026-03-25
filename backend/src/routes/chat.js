const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { handleChat, getChatHistory, clearChatHistory } = require('../controllers/chatController');

const router = express.Router();

router.post('/', authMiddleware, handleChat);
router.get('/history', authMiddleware, getChatHistory);
router.delete('/history', authMiddleware, clearChatHistory);

module.exports = router;
