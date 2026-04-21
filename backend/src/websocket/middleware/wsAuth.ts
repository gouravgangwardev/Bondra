// ============================================
// FILE 2: src/websocket/middleware/wsAuth.ts
// ============================================
import { Socket } from 'socket.io';
import tokenService from '../../services/auth/tokenService';
import { logger } from '../../utils/logger';
import { SocketData } from '../types/events';

export const wsAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Validate token — explicitly require 'access' type so a refresh token
    // cannot be used as a WebSocket auth credential (Bug 6 fix).
    const decoded = await tokenService.validateToken(token, 'access');

    if (!decoded) {
      return next(new Error('Invalid or expired token'));
    }

    // Attach user data to socket
    socket.data = {
      userId: decoded.userId,
      username: decoded.username,
      isGuest: decoded.isGuest,
      authenticated: true,
    } as SocketData;

    logger.debug(`WebSocket authenticated: ${decoded.userId}`);
    next();
  } catch (error) {
    logger.error('WebSocket auth error:', error);
    next(new Error('Authentication failed'));
  }
};
