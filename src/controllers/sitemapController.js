/**
 * sitemap.xml and robots.txt for search engines.
 */

const pageModel = require('../models/pageModel');

// Slugs already served by their own fixed routes in app.js — skip them when
// looping over published pages so they aren't listed twice under /lesson/:slug.
const FIXED_SLUGS = new Set(['home', 'about', 'contact']);

function getBaseUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  return req.protocol + '://' + req.get('host');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function sitemap(req, res, next) {
  try {
    const baseUrl = getBaseUrl(req);

    let pages = [];
    try {
      pages = await pageModel.findPublishedPages();
    } catch (e) {
      console.error('sitemap pages error:', e.message);
    }

    const staticEntries = [
      { loc: baseUrl + '/', priority: '1.0' },
      { loc: baseUrl + '/about', priority: '0.6' },
      { loc: baseUrl + '/contact', priority: '0.6' },
      { loc: baseUrl + '/lessons', priority: '0.8' },
    ];

    const lessonEntries = (pages || [])
      .filter((page) => page.slug && !FIXED_SLUGS.has(page.slug))
      .map((page) => ({
        loc: baseUrl + '/lesson/' + encodeURIComponent(page.slug),
        lastmod: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
        priority: '0.7',
      }));

    const entries = staticEntries.concat(lessonEntries);

    const body = entries
      .map((entry) => {
        let xml = '  <url>\n    <loc>' + xmlEscape(entry.loc) + '</loc>\n';
        if (entry.lastmod) xml += '    <lastmod>' + entry.lastmod + '</lastmod>\n';
        if (entry.priority) xml += '    <priority>' + entry.priority + '</priority>\n';
        xml += '  </url>';
        return xml;
      })
      .join('\n');

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      body +
      '\n</urlset>\n';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
}

function robots(req, res) {
  const baseUrl = getBaseUrl(req);
  const body =
    'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /admin/\n' +
    'Disallow: /account\n' +
    'Disallow: /login\n' +
    'Disallow: /register\n' +
    '\n' +
    'Sitemap: ' + baseUrl + '/sitemap.xml\n';

  res.set('Content-Type', 'text/plain');
  res.send(body);
}

module.exports = { sitemap, robots };
