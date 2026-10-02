/**
 * Site-wide real-time chat (shared across all pages).
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

const GLOBAL_SCOPE = 'global';

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  const s = String(id);
  if (!ObjectId.isValid(s)) return null;
  try {
    return new ObjectId(s);
  } catch (_) {
    return null;
  }
}

async function createMessage({ userId, userName, body, pageId }) {
  const db = getDb();
  const uid = toObjectId(userId);
  if (!uid) return null;

  const cleanBody = String(body || '')
    .trim()
    .slice(0, 1000);
  if (!cleanBody) return null;

  const doc = {
    scope: GLOBAL_SCOPE,
    userId: uid,
    userName: String(userName || 'User').slice(0, 80),
    body: cleanBody,
    createdAt: new Date(),
  };

  const pid = toObjectId(pageId);
  if (pid) doc.pageId = pid;

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

async function findRecent({ limit = 100 } = {}) {
  const db = getDb();
  const rows = await db
    .collection('chat_messages')
    .find({
      $or: [{ scope: GLOBAL_SCOPE }, { scope: { $exists: false } }],
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 200))
    .toArray();

  return rows.reverse().map((m) => ({
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
