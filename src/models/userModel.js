/**
 * User data-access helpers.
 */

const { ObjectId } = require('mongodb');
function unwrapMongoDoc(result) {
  if (result == null) return null;
  if (typeof result === 'object' && 'value' in result && !result._id) return result.value || null;
  return result;
}

const { getDb } = require('../db/connect');

async function findByEmail(email) {
  const db = getDb();
  return db.collection('users').findOne({
    email: email.toLowerCase().trim(),
  });
}

async function findById(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('users').findOne(
    { _id: new ObjectId(id) },
    { projection: { passwordHash: 0 } }
  );
}

async function createUser({ name, email, passwordHash, role = 'user', avatarUrl = '' }) {
  const db = getDb();
  const now = new Date();

  const doc = {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    avatarUrl: avatarUrl || '',
    theme: 'light',
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('users').insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function findAllUsers() {
  const db = getDb();
  return db
    .collection('users')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

async function updateUserRole(id, role) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  if (!['user', 'admin'].includes(role)) return null;
  return db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { passwordHash: 0 } }
  );
}

async function updateProfile(id, { name, avatarUrl, theme } = {}) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  const $set = { updatedAt: new Date() };
  if (typeof name === 'string' && name.trim()) {
    $set.name = name.trim().slice(0, 100);
  }
  if (typeof avatarUrl === 'string') {
    $set.avatarUrl = avatarUrl;
  }
  if (theme === 'light' || theme === 'dark') {
    $set.theme = theme;
  }
  const result = await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: 'after', projection: { passwordHash: 0 } }
  );
  return unwrapMongoDoc(result);
}

async function deleteUser(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;
  const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  findAllUsers,
  updateUserRole,
  updateProfile,
  deleteUser,
};
