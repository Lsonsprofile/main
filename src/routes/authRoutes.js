/**
 * Authentication routes.
 * GET  /register  – show registration form
 * POST /register  – create account
 * GET  /login     – show login form
 * POST /login     – authenticate
 * POST /logout    – destroy session
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', authController.showRegister);
router.post('/register', authController.register);

router.get('/login', authController.showLogin);
router.post('/login', authController.login);

router.post('/logout', authController.logout);
// Allow simple links from custom HTML (still destroys session)
router.get('/logout', authController.logout);

module.exports = router;
