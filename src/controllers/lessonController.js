/**
 * Public lesson controller.
 */

const pageModel = require('../models/pageModel');
const { prepareFullDocumentHtml } = require('../utils/platformInject');
const commentModel = require('../models/commentModel');
const progressModel = require('../models/progressModel');

/**
 * Published page is visible to everyone when userAccess !== false.
 * When userAccess is false, only admins may view.
 */
function userMayViewPage(page, req) {
  if (!page) return false;
  if (page.userAccess === false) {
    return Boolean(req.session && req.session.user && req.session.user.role === 'admin');
  }
  return true;
}


async function listLessons(req, res, next) {
  try {
    let pages = [];
    try {
      pages = await pageModel.findPublishedPages();
    } catch (e) {
      console.error('listLessons pages error:', e.message);
    }

    const isAdmin = Boolean(req.session && req.session.user && req.session.user.role === 'admin');
    const visible = (pages || []).filter(function (p) {
      if (p.userAccess === false) return isAdmin;
      return true;
    });

    let completedIds = [];
    if (req.session && req.session.user && req.session.user._id) {
      try {
        completedIds = await progressModel.findCompletedPageIds(req.session.user._id);
      } catch (e) {
        completedIds = [];
      }
    }

    res.render('public/lessons', {
      title: 'Lessons – Web Development Learning Platform',
      pageTitle: 'Lessons',
      pages: visible,
      completedIds: completedIds,
    });
  } catch (err) {
    next(err);
  }
}

async function viewLesson(req, res, next) {
  try {
    const { slug } = req.params;

    const page = await pageModel.findPublishedBySlug(slug);
    if (!page) {
      return res.status(404).render('public/404', {
        title: 'Page Not Found',
        pageTitle: 'Page not found',
      });
    }

    if (!userMayViewPage(page, req)) {
      return res.status(403).render('public/403', {
        title: 'Access Denied',
        pageTitle: '403',
      });
    }

    
    // Custom HTML pages are always full documents (no platform header/footer)
    const isCustomHtml =
      page.builderType === 'custom-html' ||
      (page.htmlSource && String(page.htmlSource).trim());
    if (isCustomHtml && page.htmlSource && String(page.htmlSource).trim()) {
      const html = prepareFullDocumentHtml(req, page.htmlSource, page);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(html);
    }

let contentBlocks = [];
    try {
      contentBlocks = await pageModel.findContentByPageId(page._id, {
        onlyVisible: true,
        asTree: true,
      });
    } catch (e) {
      console.error('contentBlocks error:', e.message);
      contentBlocks = [];
    }

    let comments = [];
    try {
      comments = await commentModel.findByPageId(page._id, { status: 'visible' });
    } catch (e) {
      console.error('comments error:', e.message);
      comments = [];
    }

    let lessonCompleted = false;
    if (req.session && req.session.user && req.session.user._id) {
      try {
        lessonCompleted = await progressModel.isComplete(req.session.user._id, page._id);
      } catch (e) {
        lessonCompleted = false;
      }
    }

    res.render('public/lesson', {
      title: page.seoTitle || page.title,
      pageTitle: page.title,
      seoDescription: page.seoDescription || page.description || '',
      page,
      contentBlocks: contentBlocks || [],
      comments: comments || [],
      commentError: req.query.error || null,
      lessonCompleted: lessonCompleted,
      progressFlash: req.query.progress || null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Serve the raw custom HTML document for sandboxed iframe embedding.
 * Same-origin URL + sandbox without allow-same-origin keeps the page isolated.
 */
async function embedPage(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await pageModel.findPublishedBySlug(slug);

    if (!page) {
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title></head>' +
        '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b;">' +
        '<p>Page not found or not published.</p></body></html>'
      );
    }

    if (!userMayViewPage(page, req)) {
      res.status(403);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Access denied</title></head>' +
        '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b;">' +
        '<p>This page is admin-only. Log in as an administrator to view it.</p></body></html>'
      );
    }

    let html = typeof page.htmlSource === 'string' ? page.htmlSource : '';
    if (!html.trim()) {
      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Empty</title></head>' +
        '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b;">' +
        '<p>No HTML saved for this page yet. Open the editor, paste your document, click <strong>Save</strong>, then <strong>Publish</strong>.</p>' +
        '</body></html>'
      );
    }

    // Soft isolation: block parent access attempts in the source
    html = html
      .replace(/\bwindow\.parent\b/g, 'window.self')
      .replace(/\bwindow\.top\b/g, 'window.self')
      .replace(/\bwindow\.frameElement\b/g, 'null')
      .replace(/\s+target\s*=\s*(["'])_blank\1/gi, '')
      .replace(/\s+target\s*=\s*_blank(?=[\s>])/gi, '');

    const probe =
      '<script>(function(){function measure(){try{' +
      'var h=Math.max(' +
      'document.body?document.body.scrollHeight:0,' +
      'document.documentElement?document.documentElement.scrollHeight:0,' +
      'document.body?document.body.offsetHeight:0,' +
      '1200);' +
      'if(window.parent&&window.parent!==window){' +
      'window.parent.postMessage({type:"chf-resize",height:h},"*");}' +
      '}catch(e){}}' +
      'window.addEventListener("load",function(){measure();setTimeout(measure,500);setTimeout(measure,1500);});' +
      'setInterval(measure,1200);' +
      '})();</scr' + 'ipt>';
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, probe + '</body>');
    } else {
      html += probe;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLessons,
  viewLesson,
  embedPage,
};
