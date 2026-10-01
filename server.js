/**
 * Application entry point.
 * Connects to MongoDB, starts HTTP + Socket.io for real-time lesson chat.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connect } = require('./src/db/connect');
const { attachChatSocket } = require('./src/realtime/chatSocket');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const avatarDir = path.join(uploadDir, 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

    await connect();

    const server = http.createServer(app);
    const io = new Server(server, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      allowEIO3: true,
      cors: { origin: true, credentials: true },
    });

    const sessionMiddleware = app.sessionMiddleware;
    if (sessionMiddleware) {
      // Official pattern: run express-session on the socket handshake request
      const wrap = (middleware) => (socket, next) => {
        middleware(socket.request, {}, next);
      };
      io.use(wrap(sessionMiddleware));
      io.engine.use((req, res, next) => {
        sessionMiddleware(req, res, next);
      });
    }

    attachChatSocket(io);
    // Expose io for optional use
    app.set('io', io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Real-time chat: enabled (Socket.io + HTTP fallback)');
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
