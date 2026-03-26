const { Pool } = require('pg');
const logger = require('../utils/logger');

// const pool = new Pool({
//   host:     process.env.DB_HOST     || 'localhost',
//   port:     parseInt(process.env.DB_PORT) || 5432,
//   database: process.env.DB_NAME     || 'ai_secure_db',
//   user:     process.env.DB_USER     || 'postgres',
//   password: process.env.DB_PASSWORD || '',
//   max: 20,                   // Max pool size
//   idleTimeoutMillis: 30000,  // Close idle clients after 30s
//   connectionTimeoutMillis: 5000,
//   ssl: process.env.NODE_ENV === 'production'
//     ? { rejectUnauthorized: true }
//     : false,
// });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error(`PostgreSQL pool error: ${err.message}`);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error(`❌ PostgreSQL connection failed: ${err.message}`);
  } else {
    logger.info(`✅ PostgreSQL connected at ${res.rows[0].now}`);
  }
});

module.exports = pool;
