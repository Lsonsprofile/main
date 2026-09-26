/**
 * Security helpers: rate limiting, CSRF, request hardening.
 */

const crypto = require('crypto');

// Simple in-memory rate limit (per process). Good enough for single-instance deploys.
const buckets = new Map();

function clientKey(req, suffix) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  return ip + '|' + suffix;
}

/**
 * Rate limit middleware factory.
 * @param {{ windowMs: number, max: number, message?: string }} opts
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests. Try again later.' } = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const key = clientKey(req, req.path);
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.status(429);
      if (req.accepts('html') && !req.xhr && !(req.headers.accept || '').includes('application/json')) {
        return res.send(
          '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem">' +
            '<h1>Too many requests</h1><p>' +
            message +
            '</p><p><a href="/">Home</a></p></body></html>'
        );
      }
      return res.json({ ok: false, error: message });
    }
    next();
  };
}

/** Ensure session has a CSRF token */
function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Attach csrf token to locals for forms.
 */
function csrfLocals(req, res, next) {
  const token = ensureCsrfToken(req);
  res.locals.csrfToken = token;
  next();
}

/**
 * Validate CSRF on state-changing methods (POST/PUT/PATCH/DELETE).
 * Skips: webhook-like JSON API with matching Origin/Referer same-site, and Socket.io.
 * Accepts token from body._csrf, body.csrfToken, or header x-csrf-token.
 */
function csrfProtect(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Skip for unauthenticated public reads only — all mutating routes should pass token
  const token = ensureCsrfToken(req);
  const provided =
    (req.body && (req.body._csrf || req.body.csrfToken)) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    '';

  // Same-origin JSON saves from admin editor: check Origin/Referer
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';
  const sameOrigin =
    (origin && host && origin.replace(/^https?:\/\//, '').split('/')[0] === host) ||
    (referer && host && referer.replace(/^https?:\/\//, '').split('/')[0] === host);

  if (provided && provided === token) {
    return next();
  }

  // Allow same-origin XHR/fetch that includes credentials (admin HTML save) when Origin matches
  if (sameOrigin && (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      (req.headers.accept || '').includes('application/json') ||
      (req.headers['content-type'] || '').includes('application/json'))) {
    // Still prefer token — but accept same-origin JSON for editor compatibility
    // Require session to exist
    if (req.session && req.session.user) {
      return next();
    }
  }

  // Logout GET is intentional for custom HTML links
  if (method === 'POST' && req.path === '/logout') {
    // still require session cookie; CSRF less critical for logout
    return next();
  }

  if (provided && provided === token) return next();

  res.status(403);
  if (req.accepts('json') && (req.headers.accept || '').includes('application/json')) {
    return res.json({ ok: false, error: 'Invalid or missing CSRF token. Refresh and try again.' });
  }
  return res.send(
    '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem">' +
      '<h1>Security check failed</h1><p>Please go back, refresh the page, and try again.</p>' +
      '<p><a href="/">Home</a></p></body></html>'
  );
}

/** Strip HTML tags and control chars from plain-text user content */
function stripHtml(input, maxLen = 1000) {
  let s = String(input == null ? '' : input);
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.replace(/javascript:/gi, '');
  s = s.replace(/data:/gi, '');
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// Periodic cleanup of rate-limit buckets
setInterval(function () {
  const now = Date.now();
  for (const [k, v] of buckets.entries()) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 60 * 1000).unref();

module.exports = {
  rateLimit,
  ensureCsrfToken,
  csrfLocals,
  csrfProtect,
  stripHtml,
};
