// src/websocket/middleware/wsRateLimit.ts
// Fixed: per-event rate limits enforced on every event, not just connection.
// Falls back to in-memory map if Redis is unavailable.

import { Socket } from 'socket.io';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

interface EventLimit {
  windowMs:    number;
  maxRequests: number;
}

const EVENT_LIMITS: Record<string, EventLimit> = {
  'chat:message':  { windowMs: 1_000,  maxRequests: 5  },
  'queue:join':    { windowMs: 2_000,  maxRequests: 1  }, // 1 per 2s — prevents rapid re-queuing
  'match:next':    { windowMs: 1_000,  maxRequests: 1  }, // debounced further in matchHandler
  'call:offer':    { windowMs: 10_000, maxRequests: 10 },
  'call:answer':   { windowMs: 10_000, maxRequests: 10 },
  'call:ice':      { windowMs: 1_000,  maxRequests: 50 },
  'friend:call':   { windowMs: 5_000,  maxRequests: 3  },
};

// ── In-memory fallback ──────────────────────────────────────────────────────

interface MemBucket { count: number; resetAt: number }
const inMemBuckets = new Map<string, MemBucket>();

function inMemCheck(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  let b = inMemBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    inMemBuckets.set(key, b);
  }
  b.count++;
  return b.count <= max;
}

// Prune stale buckets every 30 s
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of inMemBuckets.entries()) {
    if (now >= b.resetAt) inMemBuckets.delete(k);
  }
}, 30_000).unref();

// ── Core check ───────────────────────────────────────────────────────────────

async function checkLimit(userId: string, event: string): Promise<boolean> {
  const cfg = EVENT_LIMITS[event];
  if (!cfg) return true; // no limit for unlisted events

  const key = `ratelimit:ws:${userId}:${event}`;

  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.pexpire(key, cfg.windowMs);
    }
    if (current > cfg.maxRequests) {
      logger.warn(`WS rate limit exceeded: ${userId} on ${event} (${current}/${cfg.maxRequests})`);
      return false;
    }
    return true;
  } catch (redisErr) {
    // Redis unavailable — use in-memory fallback
    return inMemCheck(key, cfg.windowMs, cfg.maxRequests);
  }
}

// ── Connection middleware ─────────────────────────────────────────────────────
// Guards the connection itself (max 10 new connections per minute per user).

export const wsRateLimitMiddleware = async (
  socket: Socket,
  next:   (err?: Error) => void
): Promise<void> => {
  try {
    const userId = socket.data?.userId;
    if (!userId) return next();

    const connKey = `ratelimit:ws:conn:${userId}`;
    try {
      const connCount = await redisClient.incr(connKey);
      if (connCount === 1) await redisClient.expire(connKey, 60);
      if (connCount > 10) {
        logger.warn(`WS connection rate limit exceeded: ${userId}`);
        return next(new Error('Too many connections'));
      }
    } catch {
      // Redis down — allow connection, in-memory check below catches abuse
      if (!inMemCheck(connKey, 60_000, 10)) {
        return next(new Error('Too many connections'));
      }
    }

    // Wrap socket.on to enforce per-event limits transparently
    const origOn = socket.on.bind(socket);
    (socket as any).on = (event: string, handler: (...args: any[]) => void) => {
      if (Object.prototype.hasOwnProperty.call(EVENT_LIMITS, event)) {
        return origOn(event, async (...args: any[]) => {
          const allowed = await checkLimit(userId, event);
          if (!allowed) {
            socket.emit('error', { message: 'Rate limit exceeded', event });
            return;
          }
          handler(...args);
        });
      }
      return origOn(event, handler);
    };

    next();
  } catch (error) {
    logger.error('wsRateLimitMiddleware error:', error);
    next(); // fail open on unexpected errors
  }
};
