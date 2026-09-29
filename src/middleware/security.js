/**
 * Security helpers: rate limiting, CSRF, request hardening.
 */

const crypto = require('crypto');

const buckets = new Map();

function clientKey(req, suffix) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  return ip + '|' + suffix;
}

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

function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

function csrfLocals(req, res, next) {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
}

function hostOnly(value) {
  if (!value) return '';
  try {
    if (value.includes('://')) {
      return new URL(value).host.toLowerCase();
    }
    return String(value).split('/')[0].toLowerCase();
  } catch (e) {
    return String(value).split('/')[0].toLowerCase();
  }
}

function isSameOriginRequest(req) {
  const host = hostOnly(req.headers.host || '');
  const origin = hostOnly(req.headers.origin || '');
  const referer = hostOnly(req.headers.referer || '');
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();

  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return true;
  }
  if (origin && host && origin === host) return true;
  if (referer && host && referer === host) return true;
  if (!origin && !referer && req.session && req.session.user) {
    return true;
  }
  return false;
}

function csrfProtect(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  if (req.path === '/logout') {
    return next();
  }

  const token = ensureCsrfToken(req);
  const provided =
    (req.body && (req.body._csrf || req.body.csrfToken)) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    '';

  if (provided && token && provided === token) {
    return next();
  }

  // Logged-in same-origin browser (HTML forms + fetch)
  if (isSameOriginRequest(req) && req.session && req.session.user) {
    return next();
  }

  if (isSameOriginRequest(req) && (req.path === '/login' || req.path === '/register')) {
    return next();
  }

  res.status(403);
  if ((req.headers.accept || '').includes('application/json')) {
    return res.json({
      ok: false,
      error: 'Invalid or missing CSRF token. Refresh the page and try again.',
    });
  }
  return res.send(
    '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem">' +
      '<h1>Security check failed</h1>' +
      '<p>Please go back, refresh the page, and try again.</p>' +
      '<p><a href="/">Home</a></p></body></html>'
  );
}

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

/**
 * Strip keys that start with $ or contain . from objects (NoSQL operator injection).
 * Does not alter string values (needed for HTML source saves).
 */
function sanitizeKeys(value, depth) {
  if (depth > 8) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeKeys(v, depth + 1));
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = sanitizeKeys(value[key], depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeRequestBody(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeKeys(req.body, 0);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeKeys(req.query, 0);
    }
  } catch (e) {
    // never block the request on sanitizer failure
  }
  next();
}

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
  sanitizeRequestBody,
};
