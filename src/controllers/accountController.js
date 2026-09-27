/**
 * User account / profile dashboard (all roles).
 * Users: profile + progress. Admins: same + link to admin panel.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const userModel = require('../models/userModel');
const pageModel = require('../models/pageModel');
const progressModel = require('../models/progressModel');
const { cleanString, isValidObjectId } = require('../utils/sanitize');

const avatarDir = path.join(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const id = req.session.user && req.session.user._id ? req.session.user._id : 'user';
    cb(null, id + '-' + Date.now() + ext);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed (jpg, png, gif, webp).'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

function syncSessionUser(req, user) {
  if (!req.session.user || !user) return;
  req.session.user.name = user.name;
  req.session.user.email = user.email;
  req.session.user.role = user.role;
  req.session.user.avatarUrl = user.avatarUrl || '';
  req.session.user.theme = user.theme === 'dark' ? 'dark' : 'light';
}

async function loadProgressForUser(userId) {
  const completedIds = await progressModel.findCompletedPageIds(userId);
  let pages = [];
  try {
    pages = await pageModel.findPublishedPages();
  } catch (e) {
    pages = [];
  }
  // Also include published pages without week numbers
  let allPublished = [];
  try {
    allPublished = await pageModel.findAllPages();
    allPublished = (allPublished || []).filter((p) => p.status === 'published');
  } catch (e) {
    allPublished = pages || [];
  }

  const byId = new Map((allPublished || []).map((p) => [String(p._id), p]));
  const completed = completedIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      weekNumber: p.weekNumber,
    }));

  const totalLessons = (pages || []).filter((p) => p.userAccess !== false).length || (allPublished || []).length;
  return {
    completedIds,
    completed,
    completedCount: completed.length,
    totalLessons,
  };
}

async function showAccount(req, res) {
  return res.redirect('/account/settings');
}

/** Admin panel profile (same data, admin chrome). */
async function showAdminProfile(req, res) {
  return res.redirect('/account/settings');
}

async function updateAdminProfile(req, res, next) {
  try {
    if (!req.session.user || !isValidObjectId(req.session.user._id)) {
      return res.redirect('/login');
    }
    const name = cleanString(req.body.name, 100);
    if (!name || name.length < 2) {
      return res.redirect('/admin/profile?error=name');
    }
    const updates = { name };
    if (req.file) {
      updates.avatarUrl = '/uploads/avatars/' + req.file.filename;
    }
    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);
    res.redirect('/admin/profile?success=updated');
  } catch (err) {
    if (err && err.message && /image/i.test(err.message)) {
      return res.redirect('/admin/profile?error=image');
    }
    next(err);
  }
}

async function updateAccount(req, res, next) {
  try {
    if (!req.session.user || !isValidObjectId(req.session.user._id)) {
      return res.redirect('/login');
    }

    const name = cleanString(req.body.name, 100);
    if (!name || name.length < 2) {
      return res.redirect('/account/settings?error=name');
    }

    const updates = { name };
    if (req.file) {
      updates.avatarUrl = '/uploads/avatars/' + req.file.filename;
    }

    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);

    res.redirect('/account/settings?success=updated');
  } catch (err) {
    if (err && err.message && /image/i.test(err.message)) {
      return res.redirect('/account/settings?error=image');
    }
    next(err);
  }
}

async function showUserSettings(req, res, next) {
  try {
    if (!req.session.user || !isValidObjectId(req.session.user._id)) {
      return res.redirect('/login');
    }
    const user = await userModel.findById(req.session.user._id);
    if (!user) return res.redirect('/login');
    syncSessionUser(req, user);
    const theme = user.theme === 'dark' ? 'dark' : 'light';
    let progress = { completed: [], completedCount: 0, totalLessons: 0 };
    try {
      progress = await loadProgressForUser(user._id);
    } catch (e) {
      console.error('loadProgressForUser', e.message);
    }
    res.render('public/user-settings', {
      title: 'Settings',
      pageTitle: 'Settings',
      user,
      theme,
      progress,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserSettings(req, res, next) {
  try {
    if (!req.session.user || !isValidObjectId(req.session.user._id)) {
      return res.redirect('/login');
    }

    const theme = req.body.theme === 'dark' ? 'dark' : 'light';
    const removeAvatar = String(req.body.removeAvatar || '') === 'true';
    const name = cleanString(req.body.name, 100);

    if (name && name.length < 2) {
      return res.redirect('/account/settings?error=name');
    }

    const updates = { theme };
    if (name) updates.name = name;

    if (removeAvatar) {
      updates.avatarUrl = '';
    } else if (req.file) {
      updates.avatarUrl = '/uploads/avatars/' + req.file.filename;
    }

    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);
    else if (req.session.user) {
      req.session.user.theme = theme;
      if (name) req.session.user.name = name;
      if (removeAvatar) req.session.user.avatarUrl = '';
      else if (req.file) req.session.user.avatarUrl = '/uploads/avatars/' + req.file.filename;
    }

    if (removeAvatar) {
      return res.redirect('/account/settings?success=avatar-removed');
    }
    res.redirect('/account/settings?success=updated');
  } catch (err) {
    if (err && err.message && /image/i.test(err.message)) {
      return res.redirect('/account/settings?error=image');
    }
    next(err);
  }
}

module.exports = {
  showAccount,
  updateAccount,
  showAdminProfile,
  updateAdminProfile,
  showUserSettings,
  updateUserSettings,
  upload,
};
