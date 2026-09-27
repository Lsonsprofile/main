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

router.get('/lessons', lessonController.listLessons);
router.get('/lesson/:slug', lessonController.viewLesson);
router.get('/lesson/:slug/progress', requireAuth, progressController.getProgressStatus);
router.post('/lesson/:slug/complete', requireAuth, progressController.markComplete);
router.post('/lesson/:slug/incomplete', requireAuth, progressController.markIncomplete);
router.get('/embed/:slug', lessonController.embedPage);

// Comments – must be logged in
router.post('/lesson/:slug/comments', requireAuth, commentController.createComment);
router.post('/comments/:id/delete', requireAuth, commentController.deleteComment);


// Account
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

// User settings (theme light/dark)
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

