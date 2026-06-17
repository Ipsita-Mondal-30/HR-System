const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createMessage } = require('../services/projectChatService');

function initProjectSocket(httpServer, app) {
  const origins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    'http://localhost:3000',
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
  });

  app.set('io', io);

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user?.email || socket.user?._id}`);

    socket.on('join:project', ({ projectId }) => {
      if (!projectId) return;
      socket.join(`project:${projectId}`);
      socket.data.projectId = projectId;
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        const { projectId, message, messageType, milestoneId } = payload || {};
        if (!projectId || !message) {
          ack?.({ error: 'projectId and message required' });
          return;
        }

        const result = await createMessage({
          projectId,
          user: socket.user,
          message,
          messageType,
          milestoneId,
        });

        io.to(`project:${projectId}`).emit('chat:message', result.message);
        if (result.botReply) {
          io.to(`project:${projectId}`).emit('chat:message', result.botReply);
        }

        ack?.({ ok: true, message: result.message, botReply: result.botReply });
      } catch (error) {
        ack?.({ error: error.message || 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.user?.email || socket.user?._id}`);
    });
  });

  return io;
}

module.exports = { initProjectSocket };
