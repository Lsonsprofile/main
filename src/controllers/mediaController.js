/**
 * Media upload & library for admins.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mediaModel = require('../models/mediaModel');
const { sanitizeText, isValidObjectId } = require('../utils/sanitize');

const uploadDir = path.join(__dirname, '../../public/uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp']; // no svg (XSS vector)
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed (jpg, png, gif, webp).'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function listMedia(req, res, next) {
  mediaModel
    .findAll()
    .then((media) => {
      res.render('admin/media', {
        title: 'Media Library',
        pageTitle: 'Media',
        media,
        success: req.query.success || null,
        error: req.query.error || null,
      });
    })
    .catch(next);
}

async function uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.redirect('/admin/media?error=nofile');
    }
    const altText = sanitizeText(req.body.altText, 200);
    await mediaModel.createMedia({
      url: '/uploads/' + req.file.filename,
      filename: req.file.originalname,
      altText,
      uploadedBy: req.session.user._id,
    });
    res.redirect('/admin/media?success=uploaded');
  } catch (err) {
    next(err);
  }
}

async function deleteMedia(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.redirect('/admin/media');
    }
    const doc = await mediaModel.deleteMedia(req.params.id);
    if (doc && doc.url) {
      const filePath = path.join(__dirname, '../../public', doc.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.redirect('/admin/media?success=deleted');
  } catch (err) {
    next(err);
  }
}

async function listMediaJson(req, res, next) {
  try {
    const media = await mediaModel.findAll({ limit: 200 });
    res.json({
      ok: true,
      media: (media || []).map((m) => ({
        id: String(m._id),
        url: m.url,
        filename: m.filename || '',
        altText: m.altText || '',
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  upload,
  listMedia,
  listMediaJson,
  uploadMedia,
  deleteMedia,
};

