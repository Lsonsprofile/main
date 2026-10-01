/**
 * HTTP chat endpoints (fallback when Socket.IO is unavailable).
 */

const chatModel = require('../models/chatModel');
const { stripHtml } = require('../middleware/security');

async function getHistory(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ ok: false, error: 'Login required' });
    }
    const pageId = String(req.params.pageId || '');
    if (!pageId || pageId.length < 10) {
      return res.status(400).json({ ok: false, error: 'Invalid page' });
    }
    const history = await chatModel.findByPageId(pageId, { limit: 80 });
    return res.json({ ok: true, history });
  } catch (err) {
    console.error('chat getHistory', err.message);
    return res.status(500).json({ ok: false, error: 'Could not load chat' });
  }
}

async function postMessage(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ ok: false, error: 'Login required' });
    }
    const pageId = String(req.params.pageId || '');
    const body = stripHtml(String((req.body && req.body.body) || ''), 1000);
    if (!pageId || pageId.length < 10) {
      return res.status(400).json({ ok: false, error: 'Invalid page' });
    }
    if (!body.trim()) {
      return res.status(400).json({ ok: false, error: 'Empty message' });
    }
    const user = req.session.user;
    const message = await chatModel.createMessage({
      pageId,
      userId: user._id,
      userName: user.name || user.email || 'User',
      body,
    });
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Invalid message' });
    }
    return res.json({ ok: true, message });
  } catch (err) {
    console.error('chat postMessage', err.message);
    return res.status(500).json({ ok: false, error: 'Send failed' });
  }
}

module.exports = { getHistory, postMessage };
