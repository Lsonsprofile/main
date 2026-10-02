/**
 * HTTP + Socket.io entrypoint.
 */

require('dotenv').config();
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
    await connect();

    const uploadsDir = path.join(__dirname, 'public', 'uploads', 'avatars');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const server = http.createServer(app);
    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: false },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      maxHttpBufferSize: 5e6,
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

    app.set('io', io);
    attachChatSocket(io);
    console.log('Real-time chat: enabled (Socket.io)');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
