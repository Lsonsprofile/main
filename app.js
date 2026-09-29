/**
 * Express application configuration.
 * This file creates and configures the Express app but does NOT start the server.
 * That responsibility belongs to server.js so that the app can be required
 * by tests without listening on a port.
 *
 * Architecture: Routes -> Controllers -> Database -> EJS Views
 */

const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables as early as possible
dotenv.config();

const publicRoutes = require('./src/routes/publicRoutes');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const {
  rateLimit,
  csrfLocals,
  csrfProtect,
  sanitizeRequestBody,
} = require('./src/middleware/security');

const app = express();

// Required on Render / reverse proxies so secure cookies and req.ip work
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// Security & request parsing middleware
// ---------------------------------------------------------------------------
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false, // custom HTML pages need inline scripts/styles
  crossOriginEmbedderPolicy: false,
  originAgentCluster: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'sameorigin' },
  noSniff: true,
  xssFilter: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(express.json({ limit: '8mb' }));
app.use(sanitizeRequestBody);
app.use(cookieParser());
app.use(methodOverride('_method'));

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Session configuration
// ---------------------------------------------------------------------------
const sessionMiddleware = session({
  name: 'webdev.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  },
  proxy: process.env.NODE_ENV === 'production',
});
app.use(sessionMiddleware);
app.use(csrfLocals);

// Rate limits on sensitive routes
app.use('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Wait 15 minutes.' }));
app.use('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many registrations from this network.' }));
app.use('/admin', rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use('/lesson', rateLimit({ windowMs: 60 * 1000, max: 180 }));

// ---------------------------------------------------------------------------
// Make session user available to all views (res.locals)
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.user || null;
  res.locals.isAuthenticated = Boolean(req.session.user);
  res.locals.isAdmin = Boolean(req.session.user && req.session.user.role === 'admin');
  res.locals.comments = res.locals.comments || [];
  res.locals.contentBlocks = res.locals.contentBlocks || [];
  res.locals.progress = res.locals.progress || null;
  res.locals.success = typeof res.locals.success !== 'undefined' ? res.locals.success : null;
  res.locals.error = typeof res.locals.error !== 'undefined' ? res.locals.error : null;
  next();
});

const pageController = require('./src/controllers/pageController');

// Home page
app.get('/', (req, res, next) => pageController.home(req, res, next));

// Auth state for custom HTML pages
app.get('/api/me', (req, res) => {
  const user = req.session && req.session.user ? req.session.user : null;
  res.json({
    loggedIn: Boolean(user),
    name: user && user.name ? user.name : '',
    role: user && user.role ? user.role : '',
    isAdmin: Boolean(user && user.role === 'admin'),
    avatarUrl: user && user.avatarUrl ? user.avatarUrl : '',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// CSRF on state-changing requests (forms + JSON)
app.use(csrfProtect);

// Public lesson routes (list + single lesson by slug)
app.use(publicRoutes);

// Authentication routes (register, login, logout)
app.use(authRoutes);

// Admin routes (protected by requireAuth + requireAdmin)
app.use('/admin', adminRoutes);

// CMS pages by slug
app.get('/:slug', (req, res, next) => {
  const reserved = new Set([
    'admin', 'login', 'register', 'logout', 'account', 'lessons', 'lesson',
    'embed', 'api', 'health', 'socket.io', 'uploads', 'css', 'js', 'favicon.ico',
  ]);
  if (reserved.has(String(req.params.slug || '').toLowerCase())) {
    return next();
  }
  return pageController.viewSitePage(req.params.slug, req, res, next);
});

// Soft not-found
app.use((req, res) => {
  res.status(404).render('public/404', {
    title: 'Page Not Found',
    pageTitle: 'Page not found',
  });
});

// Global error handler — never leak stack traces in production
app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  const status = err.status || 500;
  const safeMessage =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again later.'
      : (err && err.message) || 'Server error';

  const accept = String(req.headers.accept || '');
  if (
    accept.includes('application/json') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers['content-type'] || '').includes('application/json')
  ) {
    return res.status(status).json({ ok: false, error: safeMessage });
  }

  res.status(status).render('public/500', {
    title: 'Server Error',
    pageTitle: 'Error',
    message: safeMessage,
  });
});

app.sessionMiddleware = sessionMiddleware;
module.exports = app;
