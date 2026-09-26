/**
 * Page & Content data-access helpers.
 * Uses the official MongoDB driver via getDb().
 * Controllers call these functions; no database logic lives in routes or views.
 */

const { ObjectId } = require('mongodb');

/** Mongo driver v6 returns the doc; older shapes used { value: doc }. */
function unwrapMongoDoc(result) {
  if (result == null) return null;
  if (typeof result === 'object' && result.value !== undefined && result.ok !== undefined) {
    return result.value || null;
  }
  // Driver v6: document itself (has _id) or null
  if (typeof result === 'object' && (result._id || result.slug || result.htmlSource !== undefined || result.title)) {
    return result;
  }
  if (typeof result === 'object' && 'value' in result) {
    return result.value || null;
  }
  return result;
}

const { getDb } = require('../db/connect');
const { normalizeComponentState } = require('../utils/componentState');

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

async function findPublishedPages() {
  const db = getDb();
  // Published lessons/content pages (exclude common static site shells)
  return db
    .collection('pages')
    .find({
      status: 'published',
      slug: { $nin: ['home', 'about', 'contact'] },
    })
    .sort({ weekNumber: 1, title: 1, updatedAt: -1 })
    .toArray();
}

async function findPublishedBySlug(slug) {
  const db = getDb();
  return db.collection('pages').findOne({
    slug,
    status: 'published',
  });
}

async function findById(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('pages').findOne({ _id: new ObjectId(id) });
}

/**
 * All pages for the admin list (any status).
 */
async function findAllPages() {
  const db = getDb();
  const pages = await db
    .collection('pages')
    .find({})
    .sort({ updatedAt: -1 })
    .toArray();
  // Keep homepage first so it is easy to find
  pages.sort((a, b) => {
    if (a.slug === 'home') return -1;
    if (b.slug === 'home') return 1;
    return 0;
  });
  return pages;
}

/**
 * Create a new page (usually as draft).
 */
async function createPage(data) {
  const db = getDb();
  const now = new Date();

  const doc = {
    title: data.title,
    slug: data.slug,
    description: data.description || '',
    category: data.category || '',
    weekNumber: data.weekNumber ? Number(data.weekNumber) : null,
    status: data.status || 'draft',
    featuredImage: data.featuredImage || '',
    seoTitle: data.seoTitle || data.title,
    seoDescription: data.seoDescription || data.description || '',
    // Full HTML document builder (replaces visual block builder)
    builderType: data.builderType || 'custom-html',
    htmlSource: typeof data.htmlSource === 'string' ? data.htmlSource : '',
    settings: {
      showHeader: false,
      showFooter: false,
      showSidebar: false,
    },
    // When false, only admins can open the page (users get 403)
    userAccess: data.userAccess !== false,
    // Site chrome menus (default off — pages are reached via direct links)
    listInNav: data.listInNav === true,
    listInFooter: data.listInFooter === true,
    createdBy: data.createdBy || null,
    createdAt: now,
    updatedAt: now,
    publishedAt: data.status === 'published' ? now : null,
  };

  const result = await db.collection('pages').insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

/**
 * Update page metadata.
 */
async function updatePage(id, data) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const update = {
    title: data.title,
    slug: data.slug,
    description: data.description || '',
    category: data.category || '',
    weekNumber: data.weekNumber ? Number(data.weekNumber) : null,
    status: data.status,
    featuredImage: data.featuredImage || '',
    seoTitle: data.seoTitle || data.title,
    seoDescription: data.seoDescription || data.description || '',
    settings: {
      showHeader: false,
      showFooter: false,
      showSidebar: false,
    },
    updatedAt: new Date(),
  };

  if (typeof data.userAccess === 'boolean') {
    update.userAccess = data.userAccess;
  }
  if (typeof data.listInNav === 'boolean') {
    update.listInNav = data.listInNav;
  }
  if (typeof data.listInFooter === 'boolean') {
    update.listInFooter = data.listInFooter;
  }

  if (typeof data.builderType === 'string') {
    update.builderType = data.builderType;
  }
  if (typeof data.htmlSource === 'string') {
    update.htmlSource = data.htmlSource;
  }

  if (data.status === 'published') {
    update.publishedAt = new Date();
  }

  const result = await db.collection('pages').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );

  return unwrapMongoDoc(result);
}

/**
 * Save full HTML document source for a page (custom-html builder).
 */
async function updateHtmlSource(id, htmlSource) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const result = await db.collection('pages').findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        builderType: 'custom-html',
        htmlSource: typeof htmlSource === 'string' ? htmlSource : '',
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );
  const doc = unwrapMongoDoc(result);
  // Fallback: some environments return null even on success — re-read
  if (!doc) {
    return db.collection('pages').findOne({ _id: new ObjectId(id) });
  }
  return doc;
}

/**
 * Delete a page and all its content blocks.
 */
async function deletePage(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;

  const pageId = new ObjectId(id);
  await db.collection('content').deleteMany({ pageId });
  const result = await db.collection('pages').deleteOne({ _id: pageId });
  return result.deletedCount === 1;
}

/**
 * Change only the status (publish / unpublish / archive).
 */
async function setStatus(id, status) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const update = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'published') {
    update.publishedAt = new Date();
  }

  const result = await db.collection('pages').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
  return unwrapMongoDoc(result);
}

/**
 * Check if a slug is already used (optionally excluding a page id).
 */
async function slugExists(slug, excludeId = null) {
  const db = getDb();
  const query = { slug };
  if (excludeId && ObjectId.isValid(excludeId)) {
    query._id = { $ne: new ObjectId(excludeId) };
  }
  const existing = await db.collection('pages').findOne(query);
  return Boolean(existing);
}

// ---------------------------------------------------------------------------
// Content blocks (supports nesting via parentId)
// ---------------------------------------------------------------------------

/**
 * Build a tree from a flat list of blocks.
 * Top-level blocks have parentId === null / undefined.
 */
function buildContentTree(blocks) {
  const map = new Map();
  const roots = [];

  blocks.forEach((b) => {
    map.set(b._id.toString(), { ...b, children: [] });
  });

  blocks.forEach((b) => {
    const node = map.get(b._id.toString());
    const parentKey = b.parentId ? b.parentId.toString() : null;
    if (parentKey && map.has(parentKey)) {
      map.get(parentKey).children.push(node);
    } else {
      roots.push(node);
    }
  });

  function sortRecursive(nodes) {
    nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
    nodes.forEach((n) => sortRecursive(n.children || []));
  }
  sortRecursive(roots);
  return roots;
}

async function findContentByPageId(pageId, { onlyVisible = true, asTree = false } = {}) {
  const db = getDb();
  const query = { pageId: new ObjectId(pageId) };
  if (onlyVisible) {
    query.visible = true;
  }
  const blocks = await db
    .collection('content')
    .find(query)
    .sort({ order: 1 })
    .toArray();

  if (asTree) {
    return buildContentTree(blocks);
  }
  return blocks;
}

async function findContentById(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('content').findOne({ _id: new ObjectId(id) });
}

/**
 * Create a new content block.
 * Optional parentId nests it under another block.
 */
async function createContentBlock(pageId, { type, data = {}, visible = true, parentId = null }) {
  const db = getDb();
  const pid = new ObjectId(pageId);

  const filter = { pageId: pid };
  if (parentId && ObjectId.isValid(parentId)) {
    filter.parentId = new ObjectId(parentId);
  } else {
    filter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
  }

  const last = await db
    .collection('content')
    .find(filter)
    .sort({ order: -1 })
    .limit(1)
    .toArray();

  const order = last.length > 0 ? last[0].order + 1 : 1;
  const now = new Date();

  const doc = {
    pageId: pid,
    parentId: parentId && ObjectId.isValid(parentId) ? new ObjectId(parentId) : null,
    type,
    order,
    ...normalizeComponentState(data),
    visible,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('content').insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function updateContentBlock(id, { data, visible, type, parentId }) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const update = { updatedAt: new Date() };
  if (data !== undefined) {
    const existing = await db.collection('content').findOne({ _id: new ObjectId(id) });
    Object.assign(update, normalizeComponentState(data, existing || {}));
  }
  if (visible !== undefined) update.visible = visible;
  if (type !== undefined) update.type = type;
  if (parentId !== undefined) {
    update.parentId = parentId && ObjectId.isValid(parentId) ? new ObjectId(parentId) : null;
  }

  const result = await db.collection('content').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
  return result;
}

/**
 * Delete a block and its descendants.
 */
async function deleteContentBlock(id, { deleteChildren = true } = {}) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;

  const blockId = new ObjectId(id);

  if (deleteChildren) {
    const pageBlock = await db.collection('content').findOne({ _id: blockId });
    if (!pageBlock) return false;

    const all = await db.collection('content').find({ pageId: pageBlock.pageId }).toArray();
    const toDelete = new Set([blockId.toString()]);

    let changed = true;
    while (changed) {
      changed = false;
      all.forEach((b) => {
        if (b.parentId && toDelete.has(b.parentId.toString()) && !toDelete.has(b._id.toString())) {
          toDelete.add(b._id.toString());
          changed = true;
        }
      });
    }

    const ids = [...toDelete].map((s) => new ObjectId(s));
    const result = await db.collection('content').deleteMany({ _id: { $in: ids } });
    return result.deletedCount > 0;
  }

  const result = await db.collection('content').deleteOne({ _id: blockId });
  return result.deletedCount === 1;
}

async function reorderContentBlocks(items) {
  const db = getDb();
  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: new ObjectId(item.id) },
      update: { $set: { order: item.order, updatedAt: new Date() } },
    },
  }));
  if (ops.length === 0) return;
  await db.collection('content').bulkWrite(ops);
}

async function duplicateContentBlock(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const original = await db.collection('content').findOne({ _id: new ObjectId(id) });
  if (!original) return null;

  const siblingFilter = {
    pageId: original.pageId,
    order: { $gt: original.order },
  };
  if (original.parentId) {
    siblingFilter.parentId = original.parentId;
  } else {
    siblingFilter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
  }

  await db.collection('content').updateMany(siblingFilter, { $inc: { order: 1 } });

  const now = new Date();
  const copy = {
    pageId: original.pageId,
    parentId: original.parentId || null,
    type: original.type,
    order: original.order + 1,
    data: { ...original.data },
    content: { ...(original.content || {}) },
    layout: { ...(original.layout || {}) },
    style: { ...(original.style || {}) },
    responsive: JSON.parse(JSON.stringify(original.responsive || {})),
    animation: { ...(original.animation || {}) },
    visible: original.visible,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('content').insertOne(copy);
  return { _id: result.insertedId, ...copy };
}


/**
 * Move a block up or down among its siblings (same parent).
 * direction: 'up' | 'down'
 */
async function moveContentBlock(id, direction) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;

  const block = await db.collection('content').findOne({ _id: new ObjectId(id) });
  if (!block) return false;

  const siblingFilter = { pageId: block.pageId };
  if (block.parentId) {
    siblingFilter.parentId = block.parentId;
  } else {
    siblingFilter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
  }

  const siblings = await db
    .collection('content')
    .find(siblingFilter)
    .sort({ order: 1 })
    .toArray();

  const index = siblings.findIndex((s) => s._id.toString() === id);
  if (index === -1) return false;

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return false;

  const other = siblings[swapIndex];
  await db.collection('content').updateOne(
    { _id: block._id },
    { $set: { order: other.order, updatedAt: new Date() } }
  );
  await db.collection('content').updateOne(
    { _id: other._id },
    { $set: { order: block.order, updatedAt: new Date() } }
  );
  return true;
}

function sameParentFilter(pageId, parentId) {
  const filter = { pageId };
  if (parentId) filter.parentId = parentId;
  else filter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
  return filter;
}

async function moveContentBlockToParent(id, parentId, order = null) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;
  const block = await db.collection('content').findOne({ _id: new ObjectId(id) });
  if (!block) return false;

  const nextParent = parentId && ObjectId.isValid(parentId) ? new ObjectId(parentId) : null;
  if (nextParent && nextParent.equals(block._id)) return false;
  if (nextParent) {
    const parentBlock = await db.collection('content').findOne({ _id: nextParent, pageId: block.pageId });
    if (!parentBlock) return false;
    const descendants = await db.collection('content').find({ pageId: block.pageId }).toArray();
    const childMap = new Map(descendants.map((item) => [item._id.toString(), item]));
    let cursor = childMap.get(nextParent.toString());
    while (cursor && cursor.parentId) {
      if (cursor.parentId.toString() === block._id.toString()) return false;
      cursor = childMap.get(cursor.parentId.toString());
    }
  }

  const siblingFilter = sameParentFilter(block.pageId, nextParent);
  const siblings = await db.collection('content').find(siblingFilter).sort({ order: 1 }).toArray();
  const nextOrder = order == null ? (siblings.length ? siblings[siblings.length - 1].order + 1 : 1) : Math.max(1, Number(order));
  await db.collection('content').updateMany(
    { ...sameParentFilter(block.pageId, block.parentId), _id: { $ne: block._id }, order: { $gt: block.order } },
    { $inc: { order: -1 } }
  );
  await db.collection('content').updateMany(
    { ...siblingFilter, _id: { $ne: block._id }, order: { $gte: nextOrder } },
    { $inc: { order: 1 } }
  );
  await db.collection('content').updateOne(
    { _id: block._id },
    { $set: { parentId: nextParent, order: nextOrder, updatedAt: new Date() } }
  );
  return true;
}

async function duplicateContentSubtree(id, targetParentId = undefined) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  const root = await db.collection('content').findOne({ _id: new ObjectId(id) });
  if (!root) return null;
  if (targetParentId) {
    if (!ObjectId.isValid(targetParentId)) return null;
    const targetParent = await db.collection('content').findOne({ _id: new ObjectId(targetParentId), pageId: root.pageId });
    if (!targetParent) return null;
  }
  const all = await db.collection('content').find({ pageId: root.pageId }).sort({ order: 1 }).toArray();
  const source = new Map([[root._id.toString(), root]]);
  all.forEach((item) => {
    let parent = item.parentId;
    while (parent) {
      if (parent.toString() === root._id.toString()) source.set(item._id.toString(), item);
      const ancestor = all.find((candidate) => candidate._id.toString() === parent.toString());
      parent = ancestor && ancestor.parentId;
    }
  });
  const now = new Date();
  const idMap = new Map();
  const ordered = [...source.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const item of ordered) {
    const siblingFilter = sameParentFilter(item.pageId, item.parentId);
    const siblings = await db.collection('content').find(siblingFilter).sort({ order: -1 }).limit(1).toArray();
    const copy = {
      pageId: item.pageId,
      parentId: idMap.get(item.parentId && item.parentId.toString()) || (item._id.equals(root._id) && targetParentId !== undefined ? (targetParentId || null) : (item.parentId || null)),
      type: item.type,
      order: siblings.length ? siblings[0].order + 1 : 1,
      data: JSON.parse(JSON.stringify(item.data || {})),
      content: JSON.parse(JSON.stringify(item.content || {})),
      layout: JSON.parse(JSON.stringify(item.layout || {})),
      style: JSON.parse(JSON.stringify(item.style || {})),
      responsive: JSON.parse(JSON.stringify(item.responsive || {})),
      animation: JSON.parse(JSON.stringify(item.animation || {})),
      visible: item.visible,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('content').insertOne(copy);
    idMap.set(item._id.toString(), result.insertedId);
  }
  return idMap.get(root._id.toString());
}

async function wrapContentBlocks(ids, { pageId, type = 'column', data = {} } = {}) {
  const db = getDb();
  if (!Array.isArray(ids) || ids.length < 1 || !ObjectId.isValid(pageId)) return null;
  const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const blocks = await db.collection('content').find({ _id: { $in: objectIds }, pageId: new ObjectId(pageId) }).sort({ order: 1 }).toArray();
  if (!blocks.length) return null;
  const parentId = blocks[0].parentId || null;
  if (blocks.some((block) => String(block.parentId || '') !== String(parentId || ''))) return null;
  const wrapper = await createContentBlock(pageId, { type, data, parentId });
  await db.collection('content').updateMany(
    { _id: { $in: blocks.map((block) => block._id) } },
    { $set: { parentId: wrapper._id, updatedAt: new Date() } }
  );
  return wrapper;
}


/**
 * Duplicate a page and all its content blocks (including nesting).
 */
async function duplicatePage(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const page = await db.collection('pages').findOne({ _id: new ObjectId(id) });
  if (!page) return null;

  const now = new Date();
  let newSlug = page.slug + '-copy';
  let n = 2;
  while (await db.collection('pages').findOne({ slug: newSlug })) {
    newSlug = page.slug + '-copy-' + n;
    n += 1;
  }

  const { _id, ...rest } = page;
  const newPageDoc = {
    ...rest,
    title: page.title + ' (Copy)',
    slug: newSlug,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };

  const insert = await db.collection('pages').insertOne(newPageDoc);
  const newPageId = insert.insertedId;

  const blocks = await db.collection('content').find({ pageId: page._id }).sort({ order: 1 }).toArray();
  // Map old block id -> new block id for parent rewiring
  const idMap = new Map();

  // First pass: create blocks without parents fixed
  for (const b of blocks) {
    const { _id: oldId, pageId, parentId, ...blockRest } = b;
    const result = await db.collection('content').insertOne({
      ...blockRest,
      pageId: newPageId,
      parentId: null, // temporary
      createdAt: now,
      updatedAt: now,
    });
    idMap.set(oldId.toString(), result.insertedId);
  }

  // Second pass: fix parentIds
  for (const b of blocks) {
    if (b.parentId) {
      const newId = idMap.get(b._id.toString());
      const newParent = idMap.get(b.parentId.toString());
      if (newId && newParent) {
        await db.collection('content').updateOne(
          { _id: newId },
          { $set: { parentId: newParent } }
        );
      }
    }
  }

  return { _id: newPageId, ...newPageDoc };
}



/**
 * Toggle whether regular users can open this page.
 * false = admin-only; true = anyone (if published).
 */
async function setUserAccess(id, userAccess) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;

  const result = await db.collection('pages').findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        userAccess: userAccess !== false,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );
  return result;
}

module.exports = {
  // Pages
  findPublishedPages,
  findPublishedBySlug,
  findById,
  findAllPages,
  createPage,
  updatePage,
  updateHtmlSource,
  deletePage,
  setStatus,
  setUserAccess,
  slugExists,
  duplicatePage,
  // Content
  buildContentTree,
  findContentByPageId,
  findContentById,
  createContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  duplicateContentBlock,
  moveContentBlock,
  moveContentBlockToParent,
  duplicateContentSubtree,
  wrapContentBlocks,
};
