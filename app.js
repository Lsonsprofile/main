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
  contentSecurityPolicy: false,
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
const useSecureCookies =
  process.env.COOKIE_SECURE === 'true' ||
  process.env.COOKIE_SECURE === '1';

const sessionMiddleware = session({
  name: 'webdev.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: useSecureCookies,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  },
  proxy: process.env.NODE_ENV === 'production',
});
app.use(sessionMiddleware);
app.use(csrfLocals);

app.use('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Wait 15 minutes.' }));
app.use('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many registrations from this network.' }));
app.use('/admin', rateLimit({ windowMs: 60 * 1000, max: 120 }));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.user || null;
  res.locals.isAuthenticated = Boolean(req.session.user);
  res.locals.isAdmin = Boolean(req.session.user && req.session.user.role === 'admin');
  res.locals.comments = res.locals.comments || [];
  res.locals.contentBlocks = res.locals.contentBlocks || [];
  res.locals.pages = res.locals.pages || [];
  res.locals.success = res.locals.success || null;
  res.locals.error = res.locals.error || null;
  res.locals.commentError = res.locals.commentError || null;
  res.locals.isPreview = false;
  res.locals.isPlaceholder = false;
  res.locals.seoDescription = res.locals.seoDescription || '';
  next();
});

const settingsModel = require('./src/models/settingsModel');
const pageModel = require('./src/models/pageModel');
app.use(async (req, res, next) => {
  try {
    const [header, footer, pages] = await Promise.all([
      settingsModel.getHeader(),
      settingsModel.getFooter(),
      pageModel.findAllPages(),
    ]);
    const validSlugs = new Set((pages || []).filter((page) => page.status === 'published').map((page) => page.slug));
    res.locals.adminPageCount = (pages || []).length;
    res.locals.publishedPageCount = validSlugs.size;
    const storedHeader = header || settingsModel.DEFAULTS.header;

    function navUrlIsPublished(url) {
      if (!url) return false;
      if (url === '/') return validSlugs.has('home');
      if (url.indexOf('/lesson/') === 0) {
        return validSlugs.has(url.slice('/lesson/'.length).split(/[?#]/)[0]);
      }
      const slug = String(url).replace(/^\//, '').split(/[?#]/)[0];
      return validSlugs.has(slug);
    }

    const navItems = (storedHeader.navItems || [])
      .filter((item) => navUrlIsPublished(item.url))
      .map((item) => item.type === 'dropdown'
        ? { ...item, children: (item.children || []).filter((child) => navUrlIsPublished(child.url)) }
        : item)
      .filter((item) => item.type !== 'dropdown' || (item.children && item.children.length > 0))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.url === item.url) === index);
    res.locals.siteHeader = { ...storedHeader, navItems };
    res.locals.siteFooter = footer || settingsModel.DEFAULTS.footer;
  } catch (e) {
    console.error('Settings load error:', e.message);
    res.locals.siteHeader = settingsModel.DEFAULTS.header;
    res.locals.siteFooter = settingsModel.DEFAULTS.footer;
  }
  next();
});

const pageController = require('./src/controllers/pageController');

app.get('/', pageController.home);
app.get('/home', (req, res) => res.redirect(301, '/'));
app.get('/about', pageController.about);
app.get('/contact', pageController.contact);

app.post('/contact', (req, res) => {
  res.render('public/site-page', {
    title: 'Message received',
    pageTitle: 'Contact',
    page: { title: 'Thank you', slug: 'contact', description: 'Your message has been received. We will get back to you soon.' },
    contentBlocks: [],
    isPlaceholder: false,
  });
});

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

app.use(csrfProtect);

app.use(publicRoutes);
app.use(authRoutes);
app.use('/admin', adminRoutes);

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

app.use((req, res) => {
  res.status(404).render('public/404', {
    title: 'Page Not Found',
    pageTitle: 'Page not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).render('public/500', {
    title: 'Server Error',
    pageTitle: 'Error',
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again later.'
      : err.message,
  });
});

app.sessionMiddleware = sessionMiddleware;
module.exports = app;
