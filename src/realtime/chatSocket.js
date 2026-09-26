/**
 * Socket.io chat rooms keyed by page id.
 */

const { ObjectId } = require('mongodb');
const chatModel = require('../models/chatModel');
const pageModel = require('../models/pageModel');
const { stripHtml } = require('../middleware/security');

/**
 * A user may join a page's chat room only if that page is one they could
 * actually view: published, and not restricted to admins via userAccess.
 * Admins can join any page (including drafts) to help/moderate.
 */
async function canAccessPageChat(pageId, user) {
  if (!ObjectId.isValid(pageId)) return false;
  const page = await pageModel.findById(pageId);
  if (!page) return false;
  if (user && user.role === 'admin') return true;
  if (page.status !== 'published') return false;
  if (page.userAccess === false) return false;
  return true;
}

function getSessionUser(socket) {
  const session = socket.request && socket.request.session;
  return session && session.user ? session.user : null;
}

function attachChatSocket(io) {
  io.on('connection', (socket) => {
    const user = getSessionUser(socket);

    socket.on('chat:join', async (payload, ack) => {
      try {
        if (!user) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }
        const pageId = payload && payload.pageId ? String(payload.pageId) : '';
        if (!(await canAccessPageChat(pageId, user))) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid page' });
          return;
        }
        const room = 'page:' + pageId;
        socket.join(room);
        socket.data.pageId = pageId;
        const history = await chatModel.findByPageId(pageId, { limit: 80 });
        if (typeof ack === 'function') ack({ ok: true, history });
      } catch (err) {
        console.error('chat:join', err.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'Could not join chat' });
      }
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        if (!user) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Login required' });
          return;
        }
        // Trust only the room this socket actually joined (and was authorized
        // for in chat:join) — never a client-supplied payload.pageId, or a
        // user could post into/read from a page's chat without permission.
        const pageId = socket.data.pageId;
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
