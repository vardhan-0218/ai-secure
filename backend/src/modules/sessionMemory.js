/**
 * JS-Side Session Memory Management
 * =================================
 * Maintains unique session IDs for streams and analyses, and stores
 * lightweight state on the Node side so it can enrich responses or
 * resume streams gracefully.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(userId = 'anonymous', prefix = 'stream') {
    const sessionId = `${prefix}_${userId}_${crypto.randomBytes(8).toString('hex')}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      chunksProcessed: 0,
      totalRisk: 0,
      status: 'active'
    });
    logger.info(`SessionCreated: ${sessionId}`);
    return sessionId;
  }

  getSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) s.lastActive = Date.now();
    return s;
  }

  updateSession(sessionId, updates = {}) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    Object.assign(session, updates);
    return session;
  }

  incrementChunks(sessionId) {
    const session = this.getSession(sessionId);
    if (session) session.chunksProcessed++;
    return session;
  }

  deleteSession(sessionId) {
    logger.info(`SessionDeleted: ${sessionId}`);
    return this.sessions.delete(sessionId);
  }

  cleanup(ttlMs = 3600000) { // 1 hour default
    const now = Date.now();
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > ttlMs) {
        this.sessions.delete(id);
        count++;
      }
    }
    if (count > 0) logger.info(`SessionCleanup: Purged ${count} expired JS sessions.`);
  }
}

// Singleton global instance
const sessionManager = new SessionManager();

// Background cleanup every 15 mins
setInterval(() => sessionManager.cleanup(), 15 * 60 * 1000);

module.exports = sessionManager;
