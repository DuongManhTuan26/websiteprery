import { Server } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { env } from '../config/env.js';

// Dashboard clients join a room per-account so `message:new` /
// `conversation:updated` events broadcast from conversation.service.js
// only reach that account's own agents — never cross-tenant.
export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true }
  });

  io.use((socket, next) => {
    try {
      const payload = verifyAccessToken(socket.handshake.auth?.token || '');
      socket.data.accountId = payload.accountId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', socket => {
    socket.join(`account:${socket.data.accountId}`);
  });

  return io;
}
