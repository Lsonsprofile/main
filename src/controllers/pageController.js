/**
 * Public site pages (home, about, contact, …).
 * Custom HTML pages are always full documents — no platform header/footer.
 */

const pageModel = require('../models/pageModel');
const { prepareFullDocumentHtml } = require('../utils/platformInject');

function userMayViewPage(page, req) {
  if (!page) return false;
  if (page.userAccess === false) {
    return Boolean(req.session && req.session.user && req.session.user.role === 'admin');
  }
  return true;
}

function isCustomHtmlPage(page) {
  return Boolean(
    page &&
      (page.builderType === 'custom-html' ||
        (page.htmlSource && String(page.htmlSource).trim()))
  );
}

async function sendFullHtml(req, res, page) {
  const html = await prepareFullDocumentHtml(req, page.htmlSource, page);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(html);
}

async function viewSitePage(slug, req, res, next) {
  try {
    let page = null;
    try {
      page = await pageModel.findPublishedBySlug(slug);
    } catch (e) {
      console.error('viewSitePage find error:', e.message);
    }

    if (!page && slug === 'home' && req.session && req.session.user && req.session.user.role === 'admin') {
      try {
        const all = await pageModel.findAllPages();
        const draftHome = (all || []).find((p) => p.slug === 'home');
        if (draftHome && req.query.preview === '1') page = draftHome;
      } catch (e) { /* ignore */ }
    }

    if (!page) {
      if (slug === 'home') {
        return res.status(200).render('public/site-page', {
          title: 'Home',
          pageTitle: 'Home',
          seoDescription: '',
          page: { title: 'Home', slug: 'home', description: '' },
          contentBlocks: [],
          isPlaceholder: true,
          isCustomHtml: false,
        });
      }
      if (slug === 'about' || slug === 'contact') {
        return res.status(200).render('public/site-page', {
          title: slug.charAt(0).toUpperCase() + slug.slice(1),
          pageTitle: slug.charAt(0).toUpperCase() + slug.slice(1),
          seoDescription: '',
          page: {
            title: slug.charAt(0).toUpperCase() + slug.slice(1),
            slug,
            description: 'This page is not set up yet. Create it in Admin → Pages.',
          },
          contentBlocks: [],
          isPlaceholder: true,
          isCustomHtml: false,
        });
      }
      const fallbackTitle = slug.charAt(0).toUpperCase() + slug.slice(1);
      return res.render('public/site-page', {
        title: fallbackTitle,
        pageTitle: fallbackTitle,
        seoDescription: '',
        page: { title: fallbackTitle, slug, description: '' },
        contentBlocks: [],
        isPlaceholder: true,
        isCustomHtml: false,
      });
    }

    if (!userMayViewPage(page, req)) {
      return res.status(403).render('public/403', {
        title: 'Access Denied',
        pageTitle: '403',
      });
    }

    if (isCustomHtmlPage(page)) {
      return await sendFullHtml(req, res, page);
    }

    let contentBlocks = [];
    try {
      contentBlocks = await pageModel.findContentByPageId(page._id, {
        onlyVisible: true,
        asTree: true,
      });
    } catch (e) {
      contentBlocks = [];
    }

    return res.render('public/site-page', {
      title: page.seoTitle || page.title,
      pageTitle: page.title,
      seoDescription: page.seoDescription || page.description || '',
      page,
      contentBlocks: contentBlocks || [],
      isPlaceholder: false,
      isCustomHtml: false,
    });
  } catch (err) {
    return next(err);
  }
}

function home(req, res, next) {
  return viewSitePage('home', req, res, next);
}
function about(req, res, next) {
  return viewSitePage('about', req, res, next);
}
function contact(req, res, next) {
  return viewSitePage('contact', req, res, next);
}

module.exports = { home, about, contact, viewSitePage };
