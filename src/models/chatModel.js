/**
 * Site-wide real-time chat (shared across all pages).
 * Soft-delete + edit (WhatsApp-style). Stores name + avatar snapshot.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

const GLOBAL_SCOPE = 'global';
const DELETED_PLACEHOLDER = 'This message was deleted';

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

function serialize(m) {
  if (!m) return null;
  const deleted = Boolean(m.deleted);
  return {
    id: String(m._id),
    userId: String(m.userId),
    userName: m.userName || 'User',
    avatarUrl: m.avatarUrl ? String(m.avatarUrl) : '',
    body: deleted ? DELETED_PLACEHOLDER : m.body,
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    deleted,
    edited: Boolean(m.edited) && !deleted,
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
  };
}

async function createMessage({ userId, userName, avatarUrl, body, pageId }) {
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
    avatarUrl: String(avatarUrl || '').slice(0, 2000),
    body: cleanBody,
    createdAt: new Date(),
    deleted: false,
    edited: false,
  };

  const pid = toObjectId(pageId);
  if (pid) doc.pageId = pid;

  const result = await db.collection('chat_messages').insertOne(doc);
  return serialize({ ...doc, _id: result.insertedId });
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

  return rows.reverse().map(serialize);
}

async function findById(id) {
  const db = getDb();
  const oid = toObjectId(id);
  if (!oid) return null;
  const row = await db.collection('chat_messages').findOne({ _id: oid });
  return row || null;
}

async function softDeleteMessage(id, { userId, isAdmin }) {
  const db = getDb();
  const oid = toObjectId(id);
  const uid = toObjectId(userId);
  if (!oid || !uid) return null;

  const existing = await db.collection('chat_messages').findOne({ _id: oid });
  if (!existing) return null;
  if (existing.deleted) return serialize(existing);

  const owner = String(existing.userId) === String(uid);
  if (!owner && !isAdmin) return null;

  await db.collection('chat_messages').updateOne(
    { _id: oid },
    {
      $set: {
        deleted: true,
        body: DELETED_PLACEHOLDER,
        deletedAt: new Date(),
        edited: false,
      },
    }
  );
  const updated = await db.collection('chat_messages').findOne({ _id: oid });
  return serialize(updated);
}

async function editMessage(id, { userId, isAdmin, body }) {
  const db = getDb();
  const oid = toObjectId(id);
  const uid = toObjectId(userId);
  if (!oid || !uid) return null;

  const cleanBody = String(body || '')
    .trim()
    .slice(0, 1000);
  if (!cleanBody) return null;

  const existing = await db.collection('chat_messages').findOne({ _id: oid });
  if (!existing || existing.deleted) return null;

  const owner = String(existing.userId) === String(uid);
  if (!owner && !isAdmin) return null;

  const editedAt = new Date();
  await db.collection('chat_messages').updateOne(
    { _id: oid },
    {
      $set: {
        body: cleanBody,
        edited: true,
        editedAt,
      },
    }
  );
  const updated = await db.collection('chat_messages').findOne({ _id: oid });
  return serialize(updated);
}

async function findByPageId(_pageId, opts) {
  return findRecent(opts);
}

module.exports = {
  createMessage,
  findRecent,
  findById,
  softDeleteMessage,
  editMessage,
  findByPageId,
  GLOBAL_SCOPE,
  DELETED_PLACEHOLDER,
};
