const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getAIChat } = require('../modules/aiService');
const pool = require('../db/pool');
const logger = require('../utils/logger');

const router = express.Router();

// ── POST /chat ────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { message, context, session_id } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

  const userId = req.user.id;

  try {
    // AI-driven chat — session_id ties it directly to Python's memory engine
    const aiResult = await getAIChat(message, session_id, context || {});

    const reply = aiResult.reply || 'I could not generate a response. Please try again.';
    const confidence = aiResult.confidence || 0;
    const followUps = aiResult.follow_up_suggestions || [];

    // Persist to DB
    try {
      await pool.query(
        'INSERT INTO chat_messages (id, user_id, role, content) VALUES ($1,$2,$3,$4)',
        [uuidv4(), userId, 'user', message]
      );
      await pool.query(
        'INSERT INTO chat_messages (id, user_id, role, content) VALUES ($1,$2,$3,$4)',
        [uuidv4(), userId, 'assistant', reply]
      );
    } catch (dbErr) {
      logger.warn(`Chat DB persist failed: ${dbErr.message}`);
    }

    res.json({
      reply,
      confidence,
      follow_up_suggestions: followUps,
      mode: aiResult.mode || 'ai',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    logger.error(`Chat error: ${err.message}`);
    res.status(500).json({ error: 'AI chat service unavailable. Check AI service configuration.' });
  }
});

// ── GET /chat/history ──────────────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT role, content, created_at FROM chat_messages
       WHERE user_id=$1 ORDER BY created_at ASC LIMIT 100`,
      [req.user.id]
    );
    res.json({ messages: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// ── DELETE /chat/history (clear session memory) ────────────────────────────────
router.delete('/history', authMiddleware, async (req, res) => {
  const { session_id } = req.body;
  if (session_id) {
    try {
      const axios = require('axios');
      await axios.delete(`${process.env.AI_SERVICE_URL || 'http://localhost:5001'}/ai/memory/${session_id}`);
    } catch (err) {
      logger.warn(`Failed to clear distributed AI memory cache: ${err.message}`);
    }
  }
  res.json({ cleared: true });
});

module.exports = router;
