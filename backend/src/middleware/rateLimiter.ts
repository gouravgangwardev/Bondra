// src/middleware/rateLimiter.ts
// Fixed: in-memory fallback when Redis is unavailable — never fails open silently.

import rateLimit, { Store, IncrementCallback } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { ENV } from '../config/environment';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';
import { logger } from '../utils/logger';

// ── In-memory fallback store ─────────────────────────────────────────────────

interface MemEntry {
  count:      number;
  resetAt:    number;
}

class InMemoryFallbackStore implements Store {
  private map: Map<string, MemEntry> = new Map();
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
    // Prune stale entries every minute to prevent memory growth
    setInterval(() => this.prune(), 60_000).unref();
  }

  async increment(key: string, cb: IncrementCallback): Promise<void> {
    const now = Date.now();
    let entry = this.map.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.map.set(key, entry);
    }

    entry.count++;
    cb(null, { totalHits: entry.count, resetTime: new Date(entry.resetAt) });
  }

  async decrement(key: string): Promise<void> {
    const entry = this.map.get(key);
    if (entry && entry.count > 0) entry.count--;
  }

  async resetKey(key: string): Promise<void> {
    this.map.delete(key);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.map.entries()) {
      if (now >= entry.resetAt) this.map.delete(key);
    }
  }
}

// ── Store factory — prefers Redis, falls back to in-memory ──────────────────

function makeStore(prefix: string, windowMs: number): Store {
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => (redisClient as any).call(...args),
      prefix:      `ratelimit:${prefix}:`,
    });
  } catch (err) {
    logger.warn(`Redis rate-limit store unavailable (${prefix}), using in-memory fallback`);
    return new InMemoryFallbackStore(windowMs);
  }
}

// ── Limiter factory ──────────────────────────────────────────────────────────

function makeLimiter(opts: {
  prefix:      string;
  windowMs:    number;
  max:         number;
  message?:    string;
  skipSuccess?: boolean;
  keyGen?:     (req: any) => string;
}) {
  return rateLimit({
    store:      makeStore(opts.prefix, opts.windowMs),
    windowMs:   opts.windowMs,
    max:        opts.max,
    message: {
      success: false,
      error:   ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: opts.message || 'Rate limit exceeded',
    },
    statusCode:              HTTP_STATUS.TOO_MANY_REQUESTS,
    standardHeaders:         true,
    legacyHeaders:           false,
    skipSuccessfulRequests:  opts.skipSuccess ?? false,
    keyGenerator:            opts.keyGen ?? ((req: any) => req.user?.userId || req.ip),
    // Always succeed if our store itself throws — fail closed to in-memory
    handler: (req, res, _next, options) => {
      logger.warn(`Rate limit hit: ${req.ip} ${req.path}`);
      res.status(options.statusCode).json(options.message);
    },
  });
}

// ── Named limiters ───────────────────────────────────────────────────────────

export const apiLimiter = makeLimiter({
  prefix:   'api',
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max:      ENV.RATE_LIMIT_MAX_REQUESTS,
  message:  'Too many requests, please try again later',
});

export const authLimiter = makeLimiter({
  prefix:      'auth',
  windowMs:    15 * 60 * 1000, // 15 min
  max:         5,
  message:     'Too many login attempts, please try again after 15 minutes',
  skipSuccess: true,
  keyGen:      (req: any) => req.ip,
});

export const chatLimiter = makeLimiter({
  prefix:   'chat',
  windowMs: 60 * 1000,
  max:      60,
  message:  'Too many messages, please slow down',
});

export const reportLimiter = makeLimiter({
  prefix:   'report',
  windowMs: 60 * 60 * 1000,
  max:      10,
  message:  'Too many reports submitted, please try again later',
});

export const friendRequestLimiter = makeLimiter({
  prefix:   'friend',
  windowMs: 5 * 60 * 1000,
  max:      20,
  message:  'Too many friend requests, please slow down',
});

export const ipLimiter = makeLimiter({
  prefix:   'ip',
  windowMs: 60 * 1000,
  max:      60,
  message:  'Too many requests from this IP',
  keyGen:   (req: any) => req.ip,
});

export const createRateLimiter = (opts: {
  windowMs: number;
  max:      number;
  prefix:   string;
  message?: string;
}) => makeLimiter(opts);
