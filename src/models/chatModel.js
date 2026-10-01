/**
 * Real-time lesson chat messages (platform-owned, not inside embeds).
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

async function createMessage({ pageId, userId, userName, body }) {
  const db = getDb();
  const doc = {
    pageId: new ObjectId(pageId),
    userId: new ObjectId(userId),
    userName: String(userName || 'User').slice(0, 80),
    body: String(body || '').trim().slice(0, 1000),
    createdAt: new Date(),
  };
  if (!doc.body) return null;
  const result = await db.collection('chat_messages').insertOne(doc);
  return {
    _id: result.insertedId,
    id: String(result.insertedId),
    pageId: String(doc.pageId),
    userId: String(doc.userId),
    userName: doc.userName,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function findByPageId(pageId, { limit = 80 } = {}) {
  const db = getDb();
  if (!ObjectId.isValid(pageId)) return [];
  const rows = await db
    .collection('chat_messages')
    .find({ pageId: new ObjectId(pageId) })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .toArray();
  return rows
    .reverse()
    .map((m) => ({
      id: String(m._id),
      pageId: String(m.pageId),
      userId: String(m.userId),
      userName: m.userName,
      body: m.body,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }));
}

module.exports = {
  createMessage,
  findByPageId,
};
