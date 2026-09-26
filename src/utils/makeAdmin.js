/**
 * Promote a user to admin by email.
 * Usage:  node src/utils/makeAdmin.js user@example.com
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connect, getDb, close } = require('../db/connect');

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node src/utils/makeAdmin.js <email>');
    process.exit(1);
  }

  try {
    await connect();
    const db = getDb();

    const result = await db.collection('users').updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { role: 'admin', updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    console.log(`Success! User "${email}" is now an admin.`);
    console.log('Log out and log back in for the change to take effect in the session.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await close();
  }
}

makeAdmin();
