/**
 * Authentication & authorization middleware.
 * Page routes → redirect / render. API/fetch routes → JSON status codes.
 */

function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  const ct = String(req.headers['content-type'] || '');
  return (
    accept.includes('application/json') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    ct.includes('application/json')
  );
}

/**
 * Require login. JSON clients get 401; browsers get redirect to /login.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(401).json({ ok: false, error: 'Login required' });
  }
  if (req.session) {
    req.session.returnTo = req.originalUrl;
  }
  return res.redirect('/login');
}

/**
 * Require admin role. JSON clients get 403; browsers get 403 page.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  return res.status(403).render('public/403', {
    title: 'Access Denied',
    pageTitle: '403',
  });
}

/** Explicit API-only variants */
function requireApiAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ ok: false, error: 'Login required' });
}

function requireApiAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, error: 'Login required' });
  }
  return res.status(403).json({ ok: false, error: 'Forbidden' });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireApiAuth,
  requireApiAdmin,
  wantsJson,
};
