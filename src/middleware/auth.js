/**
 * Authentication & authorization middleware.
 */

function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  const xhr = String(req.headers['x-requested-with'] || '') === 'XMLHttpRequest';
  const path = String(req.path || req.originalUrl || '');
  return (
    xhr ||
    accept.includes('application/json') ||
    path.indexOf('/api/') === 0 ||
    (req.headers['content-type'] || '').includes('application/json')
  );
}

/**
 * Require the user to be logged in.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(401).json({ ok: false, error: 'Login required' });
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

/**
 * Require the user to have the 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  return res.status(403).render('public/403', {
    title: 'Access Denied',
    pageTitle: '403',
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
};
