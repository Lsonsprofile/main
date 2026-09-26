/**
 * Student lesson progress (completed pages).
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

async function markComplete(userId, pageId) {
  const db = getDb();
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(pageId)) return null;

  const filter = {
    userId: new ObjectId(userId),
    pageId: new ObjectId(pageId),
  };

  const result = await db.collection('progress').findOneAndUpdate(
    filter,
    {
      $set: {
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        userId: new ObjectId(userId),
        pageId: new ObjectId(pageId),
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return result;
}

async function markIncomplete(userId, pageId) {
  const db = getDb();
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(pageId)) return false;

  const result = await db.collection('progress').deleteOne({
    userId: new ObjectId(userId),
    pageId: new ObjectId(pageId),
  });
  return result.deletedCount === 1;
}

async function isComplete(userId, pageId) {
  const db = getDb();
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(pageId)) return false;

  const doc = await db.collection('progress').findOne({
    userId: new ObjectId(userId),
    pageId: new ObjectId(pageId),
    completed: true,
  });
  return Boolean(doc);
}

async function findCompletedPageIds(userId) {
  const db = getDb();
  if (!ObjectId.isValid(userId)) return [];

  const rows = await db
    .collection('progress')
    .find({ userId: new ObjectId(userId), completed: true })
    .project({ pageId: 1 })
    .toArray();

  return rows.map((r) => String(r.pageId));
}

module.exports = {
  markComplete,
  markIncomplete,
  isComplete,
  findCompletedPageIds,
};
