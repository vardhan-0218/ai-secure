require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
});

async function migrate() {
  const migrations = [
    `ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_filename TEXT`,
    `ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_size INTEGER`,
    `ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_mime TEXT`,
    `ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_risk_level_check`,
    `ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_risk_level_check CHECK (risk_level IN ('clean', 'low', 'medium', 'high', 'critical'))`,
    `ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_input_type_check`,
    `ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_input_type_check CHECK (input_type IN ('text', 'file', 'log', 'sql', 'chat'))`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('✅', sql.slice(0, 60));
    } catch (err) {
      console.error('❌', sql.slice(0, 60));
      console.error('   ERROR:', err.message);
    }
  }

  // Verify columns now exist
  try {
    const result = await pool.query(
      `SELECT id, uploaded_filename, uploaded_size, uploaded_mime 
       FROM analysis_sessions LIMIT 1`
    );
    console.log('\n✅ Columns verified - analysis_sessions schema is correct');
    console.log('Sample row:', JSON.stringify(result.rows[0] || 'no rows'));
  } catch (err) {
    console.error('\n❌ Verification failed:', err.message);
  }

  await pool.end();
  console.log('\nMigration complete.');
}

migrate();
