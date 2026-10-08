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
  limits: { fileSize: 1.5 * 1024 * 1024 },
});

/**
 * Always persist as data-URL in MongoDB — disk paths vanish on Railway redeploys.
 */
function fileToAvatarUrl(file) {
  if (!file) return '';
  const tryRead = (p) => {
    try {
      return fs.readFileSync(p);
    } catch (_) {
      return null;
    }
  };
  let buf = null;
  if (file.path) buf = tryRead(file.path);
  if (!buf && file.buffer) buf = file.buffer;
  if (!buf) return '';

  if (buf.length > 1200000) {
    const err = new Error('Image is too large. Please use a photo under 1 MB.');
    err.code = 'AVATAR_TOO_LARGE';
    throw err;
  }
  const mime = file.mimetype || 'image/jpeg';
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

/**
 * Keep session small: never store multi-hundred-KB data-URLs in the session.
 * UI loads the real photo from DB via /api/avatar/:userId.
 */
function avatarRefForSession(user) {
  if (!user) return '';
  const raw = user.avatarUrl ? String(user.avatarUrl) : '';
  if (!raw) return '';
  if (raw.startsWith('/') && raw.length < 300) return raw;
  if (user._id) return '/api/avatar/' + String(user._id);
  return '';
}

function syncSessionUser(req, user) {
  if (!req.session.user || !user) return;
  req.session.user.name = user.name;
  req.session.user.email = user.email;
  req.session.user.role = user.role;
  req.session.user.avatarUrl = avatarRefForSession(user);
  req.session.user.theme = user.theme === 'dark' ? 'dark' : 'light';
}

async function loadProgressForUser(userId) {
  const completedIds = await progressModel.findCompletedPageIds(userId);
  const pages = await pageModel.findPublished();
  const lessons = (pages || []).filter((p) => p.slug && p.slug !== 'home');
  const idSet = new Set((completedIds || []).map(String));
  const completed = lessons.filter((l) => idSet.has(String(l._id)));
  return {
    completed,
    completedCount: completed.length,
    totalLessons: lessons.length,
  };
}

async function showAccount(req, res) {
  return res.redirect('/account/settings');
}

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
      return res.redirect('/account/settings?error=name');
    }
    const updates = { name };
    if (req.file) {
      updates.avatarUrl = fileToAvatarUrl(req.file);
    }
    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);
    res.redirect('/account/settings?success=updated');
  } catch (err) {
    if (err && (err.code === 'AVATAR_TOO_LARGE' || /too large/i.test(err.message || ''))) {
      return res.redirect('/account/settings?error=image-size');
    }
    if (err && err.message && /image/i.test(err.message)) {
      return res.redirect('/account/settings?error=image');
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
      updates.avatarUrl = fileToAvatarUrl(req.file);
    }

    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);

    res.redirect('/account/settings?success=updated');
  } catch (err) {
    if (err && (err.code === 'AVATAR_TOO_LARGE' || /too large/i.test(err.message || ''))) {
      return res.redirect('/account/settings?error=image-size');
    }
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
      updates.avatarUrl = fileToAvatarUrl(req.file);
    }

    const user = await userModel.updateProfile(req.session.user._id, updates);
    if (user) syncSessionUser(req, user);
    else if (req.session.user) {
      req.session.user.theme = theme;
      if (name) req.session.user.name = name;
      if (removeAvatar) req.session.user.avatarUrl = '';
      else if (req.file && updates.avatarUrl) {
        req.session.user.avatarUrl = '/api/avatar/' + String(req.session.user._id);
      }
    }

    if (removeAvatar) {
      return res.redirect('/account/settings?success=avatar-removed');
    }
    res.redirect('/account/settings?success=updated');
  } catch (err) {
    if (err && (err.code === 'AVATAR_TOO_LARGE' || /too large/i.test(err.message || ''))) {
      return res.redirect('/account/settings?error=image-size');
    }
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
  syncSessionUser,
};
