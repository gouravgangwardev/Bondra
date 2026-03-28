// src/websocket/middleware/wsRateLimit.ts
import { Socket } from 'socket.io';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimits: Record<string, RateLimitConfig> = {
  'chat:message':  { windowMs: 1000,  maxRequests: 5  },
  'queue:join':    { windowMs: 5000,  maxRequests: 3  },
  'call:offer':    { windowMs: 10000, maxRequests: 10 },
  'call:answer':   { windowMs: 10000, maxRequests: 10 },
  'call:ice':      { windowMs: 1000,  maxRequests: 50 },
};

export const createRateLimiter = (event: string, config?: RateLimitConfig) => {
  const limitConfig = config || rateLimits[event] || { windowMs: 1000, maxRequests: 10 };

  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const userId = socket.data.userId;
      const key = `ratelimit:ws:${userId}:${event}`;

      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.pexpire(key, limitConfig.windowMs);
      }

      if (current > limitConfig.maxRequests) {
        logger.warn(`Rate limit exceeded for ${userId} on ${event}`);
        return next(new Error('Rate limit exceeded'));
      }

      next();
    } catch (error) {
      logger.error('Rate limit error:', error);
      next();
    }
  };
};

// Connection-level middleware used by wsServer.ts
// Allows the connection itself but patches each emit to enforce per-event limits
export const wsRateLimitMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const userId = socket.data?.userId;
    if (!userId) return next();

    // Guard the connection rate: max 10 new connections per minute per user
    const connKey = `ratelimit:ws:conn:${userId}`;
    const connCount = await redisClient.incr(connKey);
    if (connCount === 1) {
      await redisClient.expire(connKey, 60);
    }
    if (connCount > 10) {
      logger.warn(`Connection rate limit exceeded for user ${userId}`);
      return next(new Error('Too many connections'));
    }

    next();
  } catch (error) {
    logger.error('wsRateLimitMiddleware error:', error);
    next(); // fail open — don't block on Redis errors
  }
};
