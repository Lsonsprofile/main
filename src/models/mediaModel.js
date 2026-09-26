/**
 * Media metadata helpers.
 * Files are stored on disk under public/uploads; metadata in MongoDB.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connect');

async function createMedia({ url, filename, altText, uploadedBy }) {
  const db = getDb();
  const doc = {
    url,
    filename,
    altText: altText || '',
    uploadedBy: uploadedBy ? new ObjectId(uploadedBy) : null,
    createdAt: new Date(),
  };
  const result = await db.collection('media').insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function findAll({ limit = 100 } = {}) {
  const db = getDb();
  return db.collection('media').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

async function findById(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('media').findOne({ _id: new ObjectId(id) });
}

async function deleteMedia(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  const doc = await db.collection('media').findOneAndDelete({ _id: new ObjectId(id) });
  return doc;
}

module.exports = { createMedia, findAll, findById, deleteMedia };
