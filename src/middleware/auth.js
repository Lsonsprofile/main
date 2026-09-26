/**
 * Authentication & authorization middleware.
 */

/**
 * Require the user to be logged in.
 * If not, save the current URL and redirect to login.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

/**
 * Require the user to have the 'admin' role.
 * Must be used after requireAuth (or check both).
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).render('public/403', {
    title: 'Access Denied',
    pageTitle: '403',
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
};
