/**
 * Comment controllers – validated content, ownership checks.
 */

const commentModel = require('../models/commentModel');
const pageModel = require('../models/pageModel');
const { cleanString, isValidObjectId } = require('../utils/sanitize');

async function createComment(req, res, next) {
  try {
    const { slug } = req.params;
    const content = cleanString(req.body.content, 2000);

    if (!content || content.trim().length < 2) {
      return res.status(400).redirect(`/lesson/${encodeURIComponent(slug)}?error=comment-empty`);
    }

    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      return res.status(404).render('public/404', {
        title: 'Lesson Not Found',
        pageTitle: '404',
      });
    }

    if (!req.session.user || !isValidObjectId(req.session.user._id)) {
      return res.redirect('/login');
    }

    await commentModel.createComment({
      pageId: page._id,
      userId: req.session.user._id,
      content,
    });

    res.redirect(`/lesson/${encodeURIComponent(slug)}#comments`);
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).redirect('back');
    }

    const comment = await commentModel.findById(req.params.id);
    if (!comment) {
      return res.status(404).redirect('back');
    }

    const isOwner = comment.userId.toString() === req.session.user._id;
    const isAdmin = req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).render('public/403', {
        title: 'Access Denied',
        pageTitle: '403',
      });
    }

    await commentModel.deleteComment(req.params.id);

    if (req.body.redirectSlug) {
      const safeSlug = String(req.body.redirectSlug).replace(/[^a-z0-9-]/gi, '');
      return res.redirect(`/lesson/${safeSlug}#comments`);
    }
    res.redirect('/admin/comments?success=deleted');
  } catch (err) {
    next(err);
  }
}

async function adminListComments(req, res, next) {
  try {
    const comments = await commentModel.findAll({ limit: 100 });
    res.render('admin/comments', {
      title: 'Moderate Comments',
      pageTitle: 'Comments',
      comments: comments || [],
      success: req.query.success || null,
    });
  } catch (err) {
    next(err);
  }
}

async function hideComment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.redirect('/admin/comments');
    }
    await commentModel.updateComment(req.params.id, { status: 'hidden' });
    res.redirect('/admin/comments?success=hidden');
  } catch (err) {
    next(err);
  }
}

async function showComment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.redirect('/admin/comments');
    }
    await commentModel.updateComment(req.params.id, { status: 'visible' });
    res.redirect('/admin/comments?success=shown');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createComment,
  deleteComment,
  adminListComments,
  hideComment,
  showComment,
};
