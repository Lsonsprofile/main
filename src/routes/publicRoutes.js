/**
 * Public routes (no authentication required for viewing).
 * Comment actions require login (middleware applied on those routes).
 */

const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const commentController = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');
const accountController = require('../controllers/accountController');
const progressController = require('../controllers/progressController');
const chatModel = require('../models/chatModel');

// ---- Site-wide chat (REST fallback when Socket.io is unavailable) ----
router.get('/api/chat/messages', requireAuth, async (req, res) => {
  try {
    const history = await chatModel.findRecent({ limit: 100 });
    res.json({ ok: true, history: history || [] });
  } catch (err) {
    console.error('GET /api/chat/messages', err.message);
    res.status(500).json({ ok: false, error: 'Could not load messages' });
  }
});

router.post('/api/chat/messages', requireAuth, async (req, res) => {
  try {
    const user = req.session && req.session.user;
    if (!user || !user._id) {
      return res.status(401).json({ ok: false, error: 'Login required' });
    }
    const { stripHtml } = require('../middleware/security');
    const body = stripHtml(String((req.body && req.body.body) || ''), 1000);
    if (!body.trim()) {
      return res.status(400).json({ ok: false, error: 'Empty message' });
    }
    const pageId = (req.body && req.body.pageId) || null;
    const message = await chatModel.createMessage({
      userId: user._id,
      userName: user.name || user.email || 'User',
      body,
      pageId,
    });
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Invalid message' });
    }
    try {
      const io = req.app.get('io');
      if (io) io.to('site:global').emit('chat:message', message);
    } catch (_) {}
    res.json({ ok: true, message });
  } catch (err) {
    console.error('POST /api/chat/messages', err.message);
    res.status(500).json({ ok: false, error: 'Send failed' });
  }
});

router.get('/lessons', lessonController.listLessons);
router.get('/lesson/:slug', lessonController.viewLesson);
router.get('/lesson/:slug/progress', requireAuth, progressController.getProgressStatus);
router.post('/lesson/:slug/complete', requireAuth, progressController.markComplete);
router.post('/lesson/:slug/incomplete', requireAuth, progressController.markIncomplete);
router.get('/embed/:slug', lessonController.embedPage);

router.post('/lesson/:slug/comments', requireAuth, commentController.createComment);
router.post('/comments/:id/delete', requireAuth, commentController.deleteComment);

router.get('/account', requireAuth, accountController.showAccount);
router.post(
  '/account',
  requireAuth,
  (req, res, next) => {
    accountController.upload.single('avatar')(req, res, (err) => {
      if (err) {
        return res.redirect('/account?error=image');
      }
      next();
    });
  },
  accountController.updateAccount
);

router.get('/account/settings', requireAuth, accountController.showUserSettings);
router.post(
  '/account/settings',
  requireAuth,
  (req, res, next) => {
    accountController.upload.single('avatar')(req, res, (err) => {
      if (err) return res.redirect('/account/settings?error=image');
      next();
    });
  },
  accountController.updateUserSettings
);

module.exports = router;
