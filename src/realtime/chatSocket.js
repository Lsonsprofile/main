/**
 * Socket.io chat rooms keyed by page id.
 * Session is re-read on each event so login state is reliable after connect.
 */

const chatModel = require('../models/chatModel');
const { stripHtml } = require('../middleware/security');

function readUser(socket) {
  try {
    const req = socket.request;
    if (!req) return null;
    const session = req.session;
    if (!session || !session.user) return null;
    return session.user;
  } catch (e) {
    return null;
  }
}

function attachChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('chat:join', async (payload, ack) => {
      try {
        const user = readUser(socket);
        if (!user) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: 'Login required. Refresh the page after logging in.' });
          }
          return;
        }
        const pageId = payload && payload.pageId ? String(payload.pageId) : '';
        if (!pageId || pageId.length < 10) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid page' });
          return;
        }
        const room = 'page:' + pageId;
        socket.join(room);
        socket.data.pageId = pageId;
        socket.data.userId = String(user._id);
        const history = await chatModel.findByPageId(pageId, { limit: 80 });
        if (typeof ack === 'function') ack({ ok: true, history });
      } catch (err) {
        console.error('chat:join', err.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'Could not join chat' });
      }
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        const user = readUser(socket);
        if (!user) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: 'Login required. Refresh the page after logging in.' });
          }
          return;
        }
        const pageId = (payload && payload.pageId) || socket.data.pageId;
        const body = payload && payload.body ? stripHtml(String(payload.body), 1000) : '';
        if (!pageId || !body.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Empty message' });
          return;
        }
        const now = Date.now();
        if (socket.data.lastMsgAt && now - socket.data.lastMsgAt < 400) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Slow down' });
          return;
        }
        socket.data.lastMsgAt = now;

        const message = await chatModel.createMessage({
          pageId,
          userId: user._id,
          userName: user.name || user.email || 'User',
          body,
        });
        if (!message) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid message' });
          return;
        }
        io.to('page:' + pageId).emit('chat:message', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        console.error('chat:message', err.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'Send failed' });
      }
    });
  });
}

module.exports = { attachChatSocket };
