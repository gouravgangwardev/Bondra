// src/socket/middleware/socketAuth.ts
import { Socket } from 'socket.io';
import { TokenService } from '../../services/auth/tokenService';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';

const tokenService = new TokenService();

export interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
  isGuest: boolean;
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    // Verify the JWT
    const payload = await tokenService.verifyAccessToken(token);
    if (!payload) {
      return next(new Error('AUTH_INVALID_TOKEN'));
    }

    // Check the user still exists and is not banned
    const user = await User.findById(payload.userId);
    if (!user) {
      return next(new Error('AUTH_USER_NOT_FOUND'));
    }
    if (user.is_banned) {
      return next(new Error('AUTH_USER_BANNED'));
    }

    // Attach identity to socket so handlers can use it
    (socket as AuthenticatedSocket).userId   = payload.userId;
    (socket as AuthenticatedSocket).username = payload.username;
    (socket as AuthenticatedSocket).isGuest  = payload.isGuest;

    logger.debug(`Socket authenticated: ${socket.id} -> user ${payload.userId}`);
    next();
  } catch (err) {
    logger.error('Socket auth error:', err);
    next(new Error('AUTH_FAILED'));
  }
}
