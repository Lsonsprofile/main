/**
 * Admin routes – all protected by requireAuth + requireAdmin.
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const accountController = require('../controllers/accountController');
const commentController = require('../controllers/commentController');
const mediaController = require('../controllers/mediaController');
const settingsController = require('../controllers/settingsController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/', adminController.dashboard);

// Admin profile (name + avatar)
router.get('/profile', accountController.showAdminProfile);
router.post(
  '/profile',
  (req, res, next) => {
    accountController.upload.single('avatar')(req, res, (err) => {
      if (err) return res.redirect('/admin/profile?error=image');
      next();
    });
  },
  accountController.updateAdminProfile
);
router.get('/home', adminController.homeEditor);

// Pages
router.get('/pages', adminController.listPages);
router.get('/pages/create', adminController.showCreatePage);
router.post('/pages', adminController.createPage);
router.get('/pages/:id/edit', adminController.showEditPage);
router.post('/pages/:id', adminController.updatePage);
router.get('/pages/:id/html-source', adminController.getHtmlSource);
router.post('/pages/:id/html', adminController.saveHtmlSource);
router.post('/pages/:id/publish', adminController.publishPage);
router.post('/pages/:id/unpublish', adminController.unpublishPage);
router.post('/pages/:id/user-access', adminController.toggleUserAccess);
router.post('/pages/:id/delete', adminController.deletePage);
router.post('/pages/:id/duplicate', adminController.duplicatePage);
router.get('/pages/:id/preview', adminController.previewPage);
router.get('/pages/:id/html-preview', adminController.htmlPreview);

// Content blocks
router.post('/pages/:id/content', adminController.addContentBlock);
router.post('/pages/:id/content/:blockId', adminController.updateContentBlock);
router.post('/pages/:id/content/:blockId/delete', adminController.deleteContentBlock);
router.post('/pages/:id/content/:blockId/duplicate', adminController.duplicateContentBlock);
router.post('/pages/:id/content/:blockId/duplicate-tree', adminController.duplicateContentSubtree);
router.post('/pages/:id/content/:blockId/move', adminController.moveContentBlock);
router.post('/pages/:id/content/:blockId/move-to', adminController.moveContentBlockToParent);
router.post('/pages/:id/content/wrap', adminController.wrapContentBlocks);

// Comments
router.get('/comments', commentController.adminListComments);
router.post('/comments/:id/hide', commentController.hideComment);
router.post('/comments/:id/show', commentController.showComment);
router.post('/comments/:id/delete', commentController.deleteComment);

// Media
router.get('/media', mediaController.listMedia);
router.get('/media/json', mediaController.listMediaJson);
router.post(
  '/media/upload',
  (req, res, next) => {
    mediaController.upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err.message);
        return res.redirect('/admin/media?error=upload');
      }
      next();
    });
  },
  mediaController.uploadMedia
);
router.post('/media/:id/delete', mediaController.deleteMedia);

// Users
router.get('/users', adminController.listUsers);
router.post('/users/:id/role', adminController.setUserRole);
router.post('/users/:id/delete', adminController.deleteUser);

// Header & footer settings
router.get('/settings', settingsController.showSettings);
router.post('/settings/header', settingsController.saveHeader);
router.post('/settings/footer', settingsController.saveFooter);

module.exports = router;
