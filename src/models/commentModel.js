/**
 * Comment data-access helpers.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

async function findByPageId(pageId, { status = 'visible' } = {}) {
  const db = getDb();
  const query = { pageId: new ObjectId(pageId) };
  if (status) query.status = status;

  return db
    .collection('comments')
    .aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          pageId: 1,
          userId: 1,
          content: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          'user.name': 1,
          'user.email': 1,
        },
      },
    ])
    .toArray();
}

async function findById(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('comments').findOne({ _id: new ObjectId(id) });
}

async function createComment({ pageId, userId, content }) {
  const db = getDb();
  const now = new Date();
  const doc = {
    pageId: new ObjectId(pageId),
    userId: new ObjectId(userId),
    content: content.trim(),
    status: 'visible', // visible | hidden | pending
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('comments').insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function updateComment(id, { content, status }) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  const update = { updatedAt: new Date() };
  if (content !== undefined) update.content = content.trim();
  if (status !== undefined) update.status = status;

  return db.collection('comments').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
}

async function deleteComment(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;
  const result = await db.collection('comments').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

async function findAll({ limit = 50 } = {}) {
  const db = getDb();
  return db
    .collection('comments')
    .aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'pages',
          localField: 'pageId',
          foreignField: '_id',
          as: 'page',
        },
      },
      { $unwind: { path: '$page', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          content: 1,
          status: 1,
          createdAt: 1,
          'user.name': 1,
          'user.email': 1,
          'page.title': 1,
          'page.slug': 1,
        },
      },
    ])
    .toArray();
}

module.exports = {
  findByPageId,
  findById,
  createComment,
  updateComment,
  deleteComment,
  findAll,
};
