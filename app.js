/**
 * Express application configuration.
 */

const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

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
const chatController = require('./src/controllers/chatController');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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
app.use(sanitizeRequestBody);
app.use(cookieParser());
app.use(methodOverride('_method'));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const sessionMiddleware = session({
  name: 'webdev.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  },
  proxy: process.env.NODE_ENV === 'production',
});
app.use(sessionMiddleware);
app.use(csrfLocals);

app.use('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts. Wait 15 minutes.' }));
app.use('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many registrations from this network.' }));
app.use('/admin', rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use('/lesson', rateLimit({ windowMs: 60 * 1000, max: 180 }));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.user || null;
  res.locals.isAuthenticated = Boolean(req.session.user);
  res.locals.isAdmin = Boolean(req.session.user && req.session.user.role === 'admin');
  res.locals.theme =
    (req.session.user && req.session.user.theme === 'dark') ? 'dark' : 'light';
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

app.get('/api/me', async (req, res) => {
  const sessionUser = req.session && req.session.user ? req.session.user : null;
  if (!sessionUser) {
    return res.json({ loggedIn: false, name: '', role: '', isAdmin: false, avatarUrl: '', theme: 'light' });
  }
  let avatarUrl = sessionUser.avatarUrl || '';
  let name = sessionUser.name || '';
  let theme = sessionUser.theme === 'dark' ? 'dark' : 'light';
  try {
    const userModel = require('./src/models/userModel');
    const dbUser = await userModel.findById(sessionUser._id);
    if (dbUser) {
      avatarUrl = dbUser.avatarUrl || '';
      name = dbUser.name || name;
      theme = dbUser.theme === 'dark' ? 'dark' : 'light';
      sessionUser.avatarUrl = avatarUrl;
      sessionUser.name = name;
      sessionUser.theme = theme;
    }
  } catch (e) { /* session fallback */ }
  res.json({
    loggedIn: true,
    name,
    role: sessionUser.role || '',
    isAdmin: Boolean(sessionUser.role === 'admin'),
    avatarUrl,
    theme,
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// Chat send/receive (HTTP) — before CSRF; controller checks login session
app.get('/api/chat/:pageId', chatController.getHistory);
app.post('/api/chat/:pageId', chatController.postMessage);

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
