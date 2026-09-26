/**
 * Rate limiters for endpoints that are attractive to abuse: login (brute
 * force), registration (mass account creation), and public comments (spam).
 * Keyed by IP by default, which is fine behind the app's `trust proxy`
 * setting in production (app.js sets it when NODE_ENV=production).
 */

const rateLimit = require('express-rate-limit');

function jsonOrRedirect(redirectTo, message) {
  return (req, res) => {
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(429).json({ ok: false, error: message });
    }
    res.status(429).redirect(redirectTo);
  };
}

// 10 attempts per 15 minutes per IP. Generous enough for a real user who
// mistypes a password a few times, tight enough to blunt brute forcing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonOrRedirect('/login?error=too-many-attempts', 'Too many login attempts. Please try again in a few minutes.'),
});

// 5 accounts per hour per IP — slows down mass account creation without
// blocking a household/office sharing one IP from signing up normally.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonOrRedirect('/register?error=too-many-attempts', 'Too many accounts created from this network. Please try again later.'),
});

// 5 comments per 5 minutes per IP — enough for genuine back-and-forth
// discussion, tight enough to blunt scripted spam.
const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonOrRedirect('/lessons?error=too-many-comments', 'Too many comments posted recently. Please wait a few minutes.'),
});

module.exports = { loginLimiter, registerLimiter, commentLimiter };
