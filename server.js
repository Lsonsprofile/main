/**
 * Application entry point.
 * Connects to MongoDB, starts HTTP + Socket.io for real-time lesson chat.
 * Same chat design as main branch.
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
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const avatarDir = path.join(uploadDir, 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }

    await connect();

    const server = http.createServer(app);
    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: false },
    });

    const sessionMiddleware = app.sessionMiddleware;
    if (sessionMiddleware) {
      io.engine.use(sessionMiddleware);
    }

    attachChatSocket(io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Real-time chat: enabled (Socket.io)');
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
