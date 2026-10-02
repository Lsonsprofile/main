/**
 * Application entry point.
 * Connects to MongoDB, starts HTTP + Socket.io for real-time chat.
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
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await connect();

    const server = http.createServer(app);
    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: false },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    });

    const sessionMiddleware = app.sessionMiddleware;
    if (sessionMiddleware) {
      io.engine.use((req, res, next) => {
        sessionMiddleware(req, res, next);
      });
      io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
      });
    }

    attachChatSocket(io);
    app.set('io', io);

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
