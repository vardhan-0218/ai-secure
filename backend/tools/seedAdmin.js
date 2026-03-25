require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../src/db/pool');

// node tools/seedAdmin.js "new.admin@company.com" "SuperSecurePass!1"

async function seedAdmin(email, password) {
  if (!email || !password) {
    console.log('Usage: node tools/seedAdmin.js <email> <password>');
    console.log('Example: node tools/seedAdmin.js john.doe@company.com SecurePass123!');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), email, hash, 'admin']
    );
    console.log('✅ Admin user successfully created!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (e) {
    if (e.message.includes('duplicate key value')) {
      await pool.query(
        'UPDATE users SET role=$1, password_hash=$2 WHERE email=$3',
        ['admin', hash, email]
      );
      console.log('✅ Updated existing admin@example.com to Admin role with new password!');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    } else {
      console.error('❌ Error creating admin:', e.message);
    }
  }
  process.exit(0);
}

// Run the script with arguments passed via terminal
const targetEmail = process.argv[2];
const targetPassword = process.argv[3];
seedAdmin(targetEmail, targetPassword);
