/**
 * Media upload & library for admins.
 */

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mediaModel = require("../models/mediaModel");
const { sanitizeText, isValidObjectId } = require("../utils/sanitize");

const uploadDir = path.join(__dirname, "../../public/uploads");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ------------------------------------------------------------------ *
 * Multer storage + filter
 * ------------------------------------------------------------------ */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]; // no svg (XSS vector)

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.includes(ext)) return cb(null, true);
  const err = new Error("Only image files are allowed (jpg, png, gif, webp).");
  err.code = "INVALID_FILE_TYPE";
  cb(err);
};

const rawUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/* ------------------------------------------------------------------ *
 * Safe upload wrappers
 *
 * Use `uploadSingle('file')` in your routes instead of
 * `upload.single('file')`. It catches multer errors and redirects
 * back to /admin/media with a friendly ?error=... code instead of
 * crashing into the global 500 handler.
 * ------------------------------------------------------------------ */

function uploadSingle(fieldName = "file") {
  const mw = rawUpload.single(fieldName);
  return function safeUpload(req, res, next) {
    mw(req, res, (err) => {
      if (!err) return next();

      // Multer's own errors (size limit, unexpected field, etc.)
      if (err instanceof multer.MulterError) {
        console.warn("[upload] multer error:", err.code, err.message);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.redirect("/admin/media?error=toobig");
        }
        return res.redirect(
          "/admin/media?error=" + encodeURIComponent(err.code.toLowerCase()),
        );
      }

      // Our fileFilter rejection
      if (err && err.code === "INVALID_FILE_TYPE") {
        return res.redirect("/admin/media?error=badtype");
      }

      // Anything else — log it, redirect, don't crash the page
      console.warn("[upload] unexpected error:", err && err.message);
      return res.redirect("/admin/media?error=uploadfailed");
    });
  };
}

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

function listMedia(req, res, next) {
  mediaModel
    .findAll()
    .then((media) => {
      res.render("admin/media", {
        title: "Media Library",
        pageTitle: "Media",
        media,
        success: req.query.success || null,
        error: req.query.error || null,
      });
    })
    .catch(next);
}

/* ------------------------------------------------------------------ *
 * Upload handler (assumes multer already ran)
 * ------------------------------------------------------------------ */

async function uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.redirect("/admin/media?error=nofile");
    }
    const altText = sanitizeText(req.body.altText, 200);
    await mediaModel.createMedia({
      url: "/uploads/" + req.file.filename,
      filename: req.file.originalname,
      altText,
      uploadedBy: req.session && req.session.user ? req.session.user._id : null,
    });
    res.redirect("/admin/media?success=uploaded");
  } catch (err) {
    console.error("[uploadMedia]", err);
    res.redirect("/admin/media?error=savefailed");
  }
}

/* ------------------------------------------------------------------ *
 * Delete
 * ------------------------------------------------------------------ */

async function deleteMedia(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.redirect("/admin/media");
    }
    const doc = await mediaModel.deleteMedia(req.params.id);
    if (doc && doc.url) {
      const filePath = path.join(__dirname, "../../public", doc.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.redirect("/admin/media?success=deleted");
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ *
 * JSON API for the editor's media picker
 * ------------------------------------------------------------------ */

async function listMediaJson(req, res, next) {
  try {
    const media = await mediaModel.findAll({ limit: 200 });
    res.json({
      ok: true,
      media: (media || []).map((m) => ({
        id: String(m._id),
        url: m.url,
        filename: m.filename || "",
        altText: m.altText || "",
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // new safe wrapper — use this in routes
  uploadSingle,
  // keep the raw multer instance for backwards compat
  upload: rawUpload,
  listMedia,
  listMediaJson,
  uploadMedia,
  deleteMedia,
};
