const pool = require('../db/pool');
const apiCache = require('../utils/cache');
const { sendSuccess, sendError } = require('../utils/response');

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(parseInt(req.query.limit || '100'), 200)]
    );
    return sendSuccess(res, { users: result.rows });
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch users', { detail: err.message });
  }
};

const getAnalysisSessions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);
    const { risk_level } = req.query;

    let result;
    if (risk_level) {
      result = await pool.query(
        `SELECT
          id, user_id, input_type, content_length,
          risk_score, risk_level, action,
          ai_summary, processing_ms,
          uploaded_filename, uploaded_size, uploaded_mime,
          created_at
         FROM analysis_sessions
         WHERE risk_level = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [risk_level, limit, offset]
      );
    } else {
      result = await pool.query(
        `SELECT
          id, user_id, input_type, content_length,
          risk_score, risk_level, action,
          ai_summary, processing_ms,
          uploaded_filename, uploaded_size, uploaded_mime,
          created_at
         FROM analysis_sessions
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    return sendSuccess(res, { sessions: result.rows, count: result.rows.length });
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch analysis sessions', { detail: err.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const cacheKey = 'admin_analytics_global';
    const cachedData = apiCache.get(cacheKey);

    if (cachedData) {
      return sendSuccess(res, cachedData);
    }

    const [usersAgg, sessionsAgg, riskDist, alertsAgg] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_users FROM users'),
      pool.query('SELECT COUNT(*)::int AS total_sessions FROM analysis_sessions'),
      pool.query(
        `SELECT risk_level, COUNT(*)::int AS count
         FROM analysis_sessions
         GROUP BY risk_level`
      ),
      pool.query(
        `SELECT severity, COUNT(*)::int AS count
         FROM alerts
         GROUP BY severity`
      ),
    ]);

    const avgRisk = await pool.query('SELECT COALESCE(AVG(risk_score)::numeric, 0)::float AS avg_risk_score FROM analysis_sessions');

    const freshData = {
      users: usersAgg.rows[0].total_users,
      sessions: sessionsAgg.rows[0].total_sessions,
      avgRiskScore: parseFloat(avgRisk.rows[0].avg_risk_score),
      riskDistribution: riskDist.rows,
      alertDistribution: alertsAgg.rows,
    };

    // Cache results for 60 seconds globally to absorb traffic spikes
    apiCache.set(cacheKey, freshData, 60);

    return sendSuccess(res, freshData);
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch analytics', { detail: err.message });
  }
};

const getAlerts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);

    const result = await pool.query(
      `SELECT id, user_id, session_id, type, severity, message, is_read, created_at
       FROM alerts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return sendSuccess(res, { alerts: result.rows, count: result.rows.length });
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch alerts', { detail: err.message });
  }
};

const removeUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return sendError(res, 400, 'You cannot delete your own account.');
    }

    // Safety constraint: Prevent lateral admin deletion
    const targetResult = await pool.query('SELECT role FROM users WHERE id = $1', [targetId]);
    if (!targetResult.rows.length) return sendError(res, 404, 'User not found');
    if (targetResult.rows[0].role === 'admin') {
      return sendError(res, 403, 'You cannot delete another administrator account.');
    }

    // CASCADE deletes are handled by schema associations to analysis_sessions, alerts, etc.
    await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
    return sendSuccess(res, { message: 'User successfully deleted.' }, 200);
  } catch (err) {
    return sendError(res, 500, 'Failed to delete user', { detail: err.message });
  }
};

module.exports = {
  getUsers,
  getAnalysisSessions,
  getAnalytics,
  getAlerts,
  removeUser,
};

