/**
 * Admin routes – all require authentication + admin role.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const accountController = require('../controllers/accountController');
const mediaController = require('../controllers/mediaController');
const commentController = require('../controllers/commentController');
const settingsController = require('../controllers/settingsController');

// Gate every admin route
router.use(requireAuth, requireAdmin);

router.get('/', adminController.dashboard);

// Admin profile (name + avatar) → redirects to unified settings
router.get('/profile', accountController.showAdminProfile);
router.post(
  '/profile',
  (req, res, next) => {
    accountController.upload.single('avatar')(req, res, (err) => {
      if (err) return res.redirect('/account/settings?error=image');
      next();
    });
  },
  accountController.updateAdminProfile
);
router.get('/home', adminController.homeEditor);

// Pages
router.get('/pages', adminController.listPages);
router.get('/pages/new', adminController.showCreateForm);
router.post('/pages', adminController.createPage);
router.get('/pages/:id/edit', adminController.showEditForm);
router.post('/pages/:id', adminController.updatePage);
router.post('/pages/:id/publish', adminController.publishPage);
router.post('/pages/:id/unpublish', adminController.unpublishPage);
router.post('/pages/:id/duplicate', adminController.duplicatePage);
router.post('/pages/:id/delete', adminController.deletePage);
router.post('/pages/:id/user-access', adminController.toggleUserAccess);
router.get('/pages/:id/html-preview', adminController.htmlPreview);
router.get('/pages/:id/preview', adminController.previewPage);

// Users
router.get('/users', adminController.listUsers);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/delete', adminController.deleteUser);

// Media
router.get('/media', mediaController.listMedia);
router.post('/media', mediaController.uploadMedia);
router.post('/media/:id/delete', mediaController.deleteMedia);

// Comments moderation
router.get('/comments', commentController.adminList);
router.post('/comments/:id/delete', commentController.adminDelete);

// Header & footer settings
router.get('/settings', settingsController.showSettings);
router.post('/settings/header', settingsController.saveHeader);
router.post('/settings/footer', settingsController.saveFooter);

module.exports = router;
