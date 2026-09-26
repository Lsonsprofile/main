/**
 * Admin: edit global header and footer (validated).
 */

const settingsModel = require('../models/settingsModel');
const { sanitizeText, cleanString, sanitizeUrl } = require('../utils/sanitize');

function showSettings(req, res, next) {
  Promise.all([settingsModel.getHeader(), settingsModel.getFooter()])
    .then(([header, footer]) => {
      res.render('admin/settings', {
        title: 'Site Settings',
        pageTitle: 'Settings',
        header: header || settingsModel.DEFAULTS.header,
        footer: footer || settingsModel.DEFAULTS.footer,
        success: req.query.success || null,
        error: null,
      });
    })
    .catch(next);
}

async function saveHeader(req, res, next) {
  try {
    const logoText = sanitizeText(req.body.logoText, 80);
    const logoImage = sanitizeUrl(req.body.logoImage, 500);

    const labels = [].concat(req.body.navLabel || []);
    const urls = [].concat(req.body.navUrl || []);
    const types = [].concat(req.body.navType || []);
    const dropdowns = [].concat(req.body.navDropdown || []);

    const navItems = labels
      .map((label, i) => {
        const item = {
          label: sanitizeText(label, 60),
          url: sanitizeUrl(urls[i] || '#', 500) || '/',
          type: types[i] === 'dropdown' ? 'dropdown' : 'link',
        };
        if (item.type === 'dropdown' && dropdowns[i]) {
          item.children = String(dropdowns[i])
            .split(',')
            .map((pair) => {
              const [l, u] = pair.split('|').map((s) => (s || '').trim());
              if (!l) return null;
              return {
                label: sanitizeText(l, 60),
                url: sanitizeUrl(u || '#', 500) || '#',
              };
            })
            .filter(Boolean);
        }
        return item;
      })
      .filter((item) => item.label);

    await settingsModel.saveHeader({ logoText, logoImage, navItems });
    res.redirect('/admin/settings?success=header');
  } catch (err) {
    next(err);
  }
}

async function saveFooter(req, res, next) {
  try {
    const aboutText = sanitizeText(req.body.aboutText, 500);
    const logoImage = sanitizeUrl(req.body.logoImage, 500);
    const copyright = sanitizeText(req.body.copyright, 200);

    const colTitles = [].concat(req.body.colTitle || []);
    const colLinks = [].concat(req.body.colLinks || []);

    const columns = colTitles
      .map((title, i) => {
        const links = String(colLinks[i] || '')
          .split('\n')
          .map((line) => {
            const parts = line.split('|').map((s) => (s || '').trim());
            if (!parts[0]) return null;
            return {
              label: sanitizeText(parts[0], 60),
              url: sanitizeUrl(parts[1] || '#', 500) || '#',
              icon: cleanString(parts[2] || '', 8),
            };
          })
          .filter(Boolean);
        return { title: sanitizeText(title, 60), links };
      })
      .filter((c) => c.title);

    const social = String(req.body.social || '')
      .split('\n')
      .map((line) => {
        const parts = line.split('|').map((s) => (s || '').trim());
        if (!parts[0]) return null;
        return {
          label: sanitizeText(parts[0], 40),
          url: sanitizeUrl(parts[1] || '#', 500) || '#',
          icon: cleanString(parts[2] || '🔗', 8),
        };
      })
      .filter(Boolean);

    await settingsModel.saveFooter({ aboutText, logoImage, columns, social, copyright });
    res.redirect('/admin/settings?success=footer');
  } catch (err) {
    next(err);
  }
}

module.exports = { showSettings, saveHeader, saveFooter };
