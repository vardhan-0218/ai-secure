const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { sendSuccess, sendError } = require('../utils/response');

const getAlerts = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const result = await pool.query(
      `SELECT * FROM alerts WHERE user_id=$1
       ORDER BY is_read ASC, created_at DESC LIMIT $2`,
      [req.user.id, Math.min(parseInt(limit), 100)]
    );
    const unread = result.rows.filter(a => !a.is_read).length;
    return sendSuccess(res, { alerts: result.rows, unreadCount: unread });
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch alerts');
  }
};

const markAlertRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE alerts SET is_read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    return sendSuccess(res, { success: true });
  } catch {
    return sendError(res, 500, 'Failed to update alert');
  }
};

const markAllAlertsRead = async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET is_read=true WHERE user_id=$1', [req.user.id]);
    return sendSuccess(res, { success: true });
  } catch {
    return sendError(res, 500, 'Failed to update alerts');
  }
};

const getAlertStats = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT severity, COUNT(*) as count FROM alerts
       WHERE user_id=$1 GROUP BY severity`,
      [req.user.id]
    );
    const unread = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE user_id=$1 AND is_read=false',
      [req.user.id]
    );
    return sendSuccess(res, {
      bySeverity: result.rows,
      unreadCount: parseInt(unread.rows[0].count),
    });
  } catch {
    return sendError(res, 500, 'Failed to fetch alert stats');
  }
};

// Internal helper — called from analyze route
async function createAlert(userId, sessionId, type, severity, message) {
  try {
    await pool.query(
      `INSERT INTO alerts (id, user_id, session_id, type, severity, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), userId, sessionId, type, severity, message]
    );
  } catch (err) {
    // Non-fatal
  }
}

module.exports = {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  getAlertStats,
  createAlert
};
