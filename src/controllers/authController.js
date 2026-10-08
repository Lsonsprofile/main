/**
 * Auth: login, register, logout.
 */

const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { body, validationResult } = require('express-validator');
const {
  cleanString,
  normalizeEmail,
} = require('../utils/sanitize');

function sessionAvatarRef(user) {
  if (!user) return '';
  if (user.avatarUrl && user._id) return '/api/avatar/' + String(user._id);
  if (user.avatarUrl && String(user.avatarUrl).startsWith('/')) return String(user.avatarUrl);
  return '';
}

async function getAuthenticatedLanding(user) {
  if (user && user.role === 'admin') return '/admin';
  return '/account/settings';
}

async function showLogin(req, res, next) {
  if (req.session.user) {
    try {
      return res.redirect(await getAuthenticatedLanding(req.session.user));
    } catch (error) {
      return next(error);
    }
  }
  res.render('auth/login', {
    title: 'Log in',
    error: null,
    email: '',
  });
}

const loginValidators = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login', {
        title: 'Log in',
        error: errors.array()[0].msg,
        email: req.body.email || '',
      });
    }

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await userModel.findByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).render('auth/login', {
        title: 'Log in',
        error: 'Invalid email or password',
        email: req.body.email || '',
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).render('auth/login', {
        title: 'Log in',
        error: 'Invalid email or password',
        email: req.body.email || '',
      });
    }

    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: sessionAvatarRef(user),
      theme: user.theme === 'dark' ? 'dark' : 'light',
    };

    const dest = await getAuthenticatedLanding(req.session.user);
    return res.redirect(dest);
  } catch (err) {
    next(err);
  }
}

async function showRegister(req, res, next) {
  if (req.session.user) {
    try {
      return res.redirect(await getAuthenticatedLanding(req.session.user));
    } catch (error) {
      return next(error);
    }
  }
  res.render('auth/register', {
    title: 'Sign up',
    error: null,
    name: '',
    email: '',
  });
}

const registerValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        title: 'Sign up',
        error: errors.array()[0].msg,
        name: req.body.name || '',
        email: req.body.email || '',
      });
    }

    const name = cleanString(req.body.name, 100);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(400).render('auth/register', {
        title: 'Sign up',
        error: 'An account with that email already exists',
        name,
        email: req.body.email || '',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userModel.createUser({
      name,
      email,
      passwordHash,
      role: 'user',
    });

    const sessionUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: sessionAvatarRef(user),
      theme: user.theme === 'dark' ? 'dark' : 'light',
    };
    req.session.user = sessionUser;

    return res.redirect(await getAuthenticatedLanding(sessionUser));
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
}

module.exports = {
  showLogin,
  login,
  loginValidators,
  showRegister,
  register,
  registerValidators,
  logout,
};
