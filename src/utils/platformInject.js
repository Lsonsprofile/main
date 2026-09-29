/**
 * Snippets injected into full custom HTML documents (server-side only).
 * Does not change the saved htmlSource in the database.
 */

function buildThemeBootstrap(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  const theme = user && user.theme === 'dark' ? 'dark' : 'light';
  return (
    '<script>try{document.documentElement.setAttribute("data-theme","' +
    theme +
    '");}catch(e){}</script>'
  );
}

function buildAuthBootstrap(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  const payload = {
    loggedIn: Boolean(user),
    name: user && user.name ? String(user.name) : '',
    role: user && user.role ? String(user.role) : '',
    isAdmin: Boolean(user && user.role === 'admin'),
    avatarUrl: user && user.avatarUrl ? String(user.avatarUrl) : '',
    csrfToken: (function () {
      try {
        if (!req.session) return '';
        if (!req.session.csrfToken) {
          req.session.csrfToken = require('crypto').randomBytes(24).toString('hex');
        }
        return String(req.session.csrfToken || '');
      } catch (e) {
        return '';
      }
    })(),
  };
  return (
    '<script>window.__AUTH__=' +
    JSON.stringify(payload).replace(/</g, '\\u003c') +
    ';</script>'
  );
}
