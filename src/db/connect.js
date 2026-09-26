/**
 * MongoDB connection module.
 * Uses the official MongoDB Node.js driver (not Mongoose)
 * as required by the project technology stack.
 *
 * Exports a connect function and a getDb helper so that
 * controllers can obtain a database instance without
 * creating multiple connections.
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

/**
 * Connect to MongoDB using environment variables.
 * Safe to call multiple times; subsequent calls return the existing connection.
 * @returns {Promise<import('mongodb').Db>}
 */
async function connect() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri || !dbName) {
    throw new Error(
      'Missing MONGODB_URI or MONGODB_DB_NAME environment variables.\n' +
      'Make sure your .env file exists in the project root and contains both values.\n' +
      'Current MONGODB_URI: ' + (uri ? '(set)' : '(missing)') + '\n' +
      'Current MONGODB_DB_NAME: ' + (dbName ? dbName : '(missing)')
    );
  }

  client = new MongoClient(uri, {
    // Recommended options for modern MongoDB driver
    maxPoolSize: 10,
  });

  await client.connect();
  db = client.db(dbName);

  // Create indexes that the application relies on
  await ensureIndexes(db);

  console.log(`Connected to MongoDB database: ${dbName}`);
  return db;
}

/**
 * Create the indexes defined in the project specification.
 * Idempotent – safe to run on every startup.
 * @param {import('mongodb').Db} database
 */
async function ensureIndexes(database) {
  await database.collection('users').createIndex({ email: 1 }, { unique: true });
  await database.collection('pages').createIndex({ slug: 1 }, { unique: true });
  await database.collection('pages').createIndex({ status: 1 });
  await database.collection('pages').createIndex({ weekNumber: 1 });
  await database.collection('content').createIndex({ pageId: 1 });
  await database.collection('comments').createIndex({ pageId: 1 });
  // Optional: compound index for ordered content retrieval
  await database.collection('content').createIndex({ pageId: 1, order: 1 });
  await database.collection('content').createIndex({ parentId: 1 });
  await database.collection('comments').createIndex({ userId: 1 });
  await database.collection('media').createIndex({ createdAt: -1 });
  await database.collection('settings').createIndex({ key: 1 }, { unique: true });
}

/**
 * Return the active database instance.
 * Throws if connect() has not been called successfully.
 * @returns {import('mongodb').Db}
 */
function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

/**
 * Gracefully close the MongoDB connection (useful for tests / shutdown).
 */
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connect,
  getDb,
  close,
};
