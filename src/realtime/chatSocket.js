/**
 * Socket.io site-wide chat (WhatsApp-style: send, edit, soft-delete).
 */

const chatModel = require('../models/chatModel');
const userModel = require('../models/userModel');
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
        const history = await chatModel.findRecent({ limit: 120 });
        if (typeof ack === 'function') {
          ack({ ok: true, history: history || [], meId: String(user._id) });
        }
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

        const body = stripHtml(String((payload && payload.body) || ''), 1000);
        if (!body.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Empty message' });
          return;
        }

        const now = Date.now();
        if (socket.data.lastMsgAt && now - socket.data.lastMsgAt < 250) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Slow down' });
          return;
        }
        socket.data.lastMsgAt = now;

        const pageId = (payload && payload.pageId) || socket.data.pageId || null;
        let avatarUrl = user.avatarUrl || '';
        let userName = user.name || user.email || 'User';
        try {
          const dbUser = await userModel.findById(user._id);
          if (dbUser) {
            if (dbUser.avatarUrl) avatarUrl = dbUser.avatarUrl;
            if (dbUser.name) userName = dbUser.name;
            if (socket.request.session && socket.request.session.user) {
              socket.request.session.user.avatarUrl = avatarUrl;
              socket.request.session.user.name = userName;
            }
          }
        } catch (_) {}

        let message = await chatModel.createMessage({
          userId: user._id,
          userName,
          avatarUrl,
          body,
          pageId,
        });
        if (!message) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid message' });
          return;
        }
        try {
          message = await chatModel.enrichOne(message);
        } catch (_) {}

        io.to(SITE_ROOM).emit('chat:message', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('chat:message', err && err.message ? err.message : err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Send failed' });
      }
    });

    socket.on('chat:delete', async (payload, ack) => {
      try {
        const user = getSessionUser(socket);
        if (!user || !user._id) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }
        const id = payload && payload.id;
        const message = await chatModel.softDeleteMessage(id, {
          userId: user._id,
          isAdmin: user.role === 'admin',
        });
        if (!message) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Cannot delete' });
          return;
        }
        io.to(SITE_ROOM).emit('chat:deleted', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('chat:delete', err && err.message ? err.message : err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Delete failed' });
      }
    });

    socket.on('chat:edit', async (payload, ack) => {
      try {
        const user = getSessionUser(socket);
        if (!user || !user._id) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }
        const id = payload && payload.id;
        const body = stripHtml(String((payload && payload.body) || ''), 1000);
        if (!body.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Empty message' });
          return;
        }
        const message = await chatModel.editMessage(id, {
          userId: user._id,
          isAdmin: user.role === 'admin',
          body,
        });
        if (!message) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Cannot edit' });
          return;
        }
        io.to(SITE_ROOM).emit('chat:edited', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('chat:edit', err && err.message ? err.message : err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Edit failed' });
      }
    });
  });
}

module.exports = { attachChatSocket, SITE_ROOM };
