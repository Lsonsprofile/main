/**
 * Student progress (mark lesson complete / incomplete).
 */

const pageModel = require('../models/pageModel');
const progressModel = require('../models/progressModel');

async function markComplete(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      return res.redirect('/lessons');
    }
    if (page.userAccess === false) {
      return res.status(403).render('public/403', {
        title: 'Access Denied',
        pageTitle: '403',
      });
    }

    await progressModel.markComplete(req.session.user._id, page._id);
    res.redirect('/lesson/' + encodeURIComponent(slug) + '?progress=done');
  } catch (err) {
    next(err);
  }
}

async function markIncomplete(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      return res.redirect('/lessons');
    }

    await progressModel.markIncomplete(req.session.user._id, page._id);
    res.redirect('/lesson/' + encodeURIComponent(slug) + '?progress=undone');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  markComplete,
  markIncomplete,
};
