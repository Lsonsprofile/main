/**
 * Socket.io site-wide chat (one room for all pages).
 * Re-reads session on every event so login state is never stuck from connect-time.
 */

const chatModel = require('../models/chatModel');
const { stripHtml } = require('../middleware/security');

const SITE_ROOM = 'site:global';

function getSessionUser(socket) {
  try {
    const session = socket.request && socket.request.session;
    return session && session.user ? session.user : null;
  } catch (_) {
    return null;
  }
}

function attachChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('chat:join', async (payload, ack) => {
      try {
        const user = getSessionUser(socket);
        if (!user || !user._id) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }
        socket.join(SITE_ROOM);
        if (payload && payload.pageId) {
          socket.data.pageId = String(payload.pageId);
        }
        const history = await chatModel.findRecent({ limit: 100 });
        if (typeof ack === 'function') ack({ ok: true, history: history || [] });
      } catch (err) {
        console.error('chat:join', err && err.message ? err.message : err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Could not join chat' });
      }
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        const user = getSessionUser(socket);
        if (!user || !user._id) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }

        const raw = payload && payload.body != null ? String(payload.body) : '';
        const body = stripHtml(raw, 1000);
        if (!body || !body.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Empty message' });
          return;
        }

        const now = Date.now();
        if (socket.data.lastMsgAt && now - socket.data.lastMsgAt < 300) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Slow down' });
          return;
        }
        socket.data.lastMsgAt = now;

        const pageId =
          (payload && payload.pageId) || socket.data.pageId || null;

        const message = await chatModel.createMessage({
          userId: user._id,
          userName: user.name || user.email || 'User',
          body,
          pageId,
        });
        if (!message) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid message' });
          return;
        }

        io.to(SITE_ROOM).emit('chat:message', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('chat:message', err && err.message ? err.message : err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Send failed' });
      }
    });
  });
}

module.exports = { attachChatSocket, SITE_ROOM };
