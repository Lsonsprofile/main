/**
 * Site-wide real-time chat (shared across all pages).
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

const GLOBAL_SCOPE = 'global';

async function createMessage({ userId, userName, body, pageId }) {
  const db = getDb();
  const doc = {
    scope: GLOBAL_SCOPE,
    userId: new ObjectId(userId),
    userName: String(userName || 'User').slice(0, 80),
    body: String(body || '').trim().slice(0, 1000),
    createdAt: new Date(),
  };
  // Optional: where the sender was (not used for rooms)
  if (pageId && ObjectId.isValid(pageId)) {
    doc.pageId = new ObjectId(pageId);
  }
  if (!doc.body) return null;
  const result = await db.collection('chat_messages').insertOne(doc);
  return {
    _id: result.insertedId,
    id: String(result.insertedId),
    userId: String(doc.userId),
    userName: doc.userName,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Recent messages for the whole site (newest last). */
async function findRecent({ limit = 100 } = {}) {
  const db = getDb();
  const rows = await db
    .collection('chat_messages')
    .find({
      $or: [{ scope: GLOBAL_SCOPE }, { scope: { $exists: false } }],
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .toArray();
  return rows
    .reverse()
    .map((m) => ({
      id: String(m._id),
      userId: String(m.userId),
      userName: m.userName,
      body: m.body,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }));
}

async function findByPageId(_pageId, opts) {
  return findRecent(opts);
}

module.exports = {
  createMessage,
  findRecent,
  findByPageId,
  GLOBAL_SCOPE,
};
