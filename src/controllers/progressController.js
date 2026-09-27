/**
 * Student progress (mark lesson complete / incomplete).
 * Supports classic form redirects and JSON fetch (custom HTML pages).
 */

const pageModel = require('../models/pageModel');
const progressModel = require('../models/progressModel');

function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  return (
    accept.includes('application/json') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers['content-type'] || '').includes('application/json')
  );
}

async function markComplete(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      if (wantsJson(req)) {
        return res.status(404).json({ ok: false, error: 'Page not found' });
      }
      return res.redirect('/');
    }
    if (page.userAccess === false) {
      if (wantsJson(req)) {
        return res.status(403).json({ ok: false, error: 'Access denied' });
      }
      return res.status(403).render('public/403', {
        title: 'Access Denied',
        pageTitle: '403',
      });
    }

    if (!req.session.user || !req.session.user._id) {
      if (wantsJson(req)) {
        return res.status(401).json({ ok: false, error: 'Login required' });
      }
      return res.redirect('/login');
    }

    await progressModel.markComplete(req.session.user._id, page._id);

    if (wantsJson(req)) {
      return res.json({ ok: true, completed: true, slug: page.slug });
    }
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
      if (wantsJson(req)) {
        return res.status(404).json({ ok: false, error: 'Page not found' });
      }
      return res.redirect('/');
    }

    if (!req.session.user || !req.session.user._id) {
      if (wantsJson(req)) {
        return res.status(401).json({ ok: false, error: 'Login required' });
      }
      return res.redirect('/login');
    }

    await progressModel.markIncomplete(req.session.user._id, page._id);

    if (wantsJson(req)) {
      return res.json({ ok: true, completed: false, slug: page.slug });
    }
    res.redirect('/lesson/' + encodeURIComponent(slug) + '?progress=undone');
  } catch (err) {
    next(err);
  }
}

/** GET progress status for a published page (logged-in user). */
async function getProgressStatus(req, res, next) {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ ok: false, error: 'Login required', completed: false });
    }
    const { slug } = req.params;
    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      return res.status(404).json({ ok: false, error: 'Page not found', completed: false });
    }
    const completed = await progressModel.isComplete(req.session.user._id, page._id);
    return res.json({ ok: true, completed: Boolean(completed), slug: page.slug });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  markComplete,
  markIncomplete,
  getProgressStatus,
};
