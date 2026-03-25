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

async function main() {
  try {
    // Get any real user ID
    const users = await pool.query('SELECT id, email FROM users LIMIT 3');
    console.log('Users:', JSON.stringify(users.rows));

    if (users.rows.length === 0) {
      console.log('No users found');
      return;
    }

    const userId = users.rows[0].id;
    console.log('\nTesting history query for user:', userId);

    const result = await pool.query(
      `SELECT id,input_type,risk_score,risk_level,action,processing_ms,created_at
            ,uploaded_filename,uploaded_size,uploaded_mime
       FROM analysis_sessions WHERE user_id=$1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, 20, 0]
    );
    console.log('History query SUCCESS - rows:', result.rows.length);
    console.log(JSON.stringify(result.rows.slice(0, 2), null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('CODE:', err.code);
    console.error('DETAIL:', err.detail);
  } finally {
    await pool.end();
  }
}

main();
