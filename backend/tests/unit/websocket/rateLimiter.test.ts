// tests/unit/websocket/rateLimiter.test.ts
// Verifies rate limiter falls back to in-memory when Redis is unavailable.

describe('wsRateLimitMiddleware in-memory fallback', () => {
  let redisIsDown = false;

  // Simulate Redis failure by making incr throw
  jest.mock('../../../src/config/redis', () => ({
    redisClient: {
      incr:    jest.fn().mockImplementation(() => {
        if (redisIsDown) throw new Error('Redis connection refused');
        return Promise.resolve(1);
      }),
      expire:  jest.fn().mockResolvedValue(1),
      set:     jest.fn().mockImplementation((k, v, ex, ttl, nx) => {
        if (redisIsDown) throw new Error('Redis connection refused');
        return Promise.resolve('OK');
      }),
    },
    REDIS_KEYS: {},
  }));

  jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  }));

  // Re-import after mock registration
  let wsRateLimitMiddleware: (socket: any, next: any) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('../../../src/websocket/middleware/wsRateLimit');
    wsRateLimitMiddleware = mod.wsRateLimitMiddleware;
  });

  function makeSocket(userId = 'user-test') {
    const listeners: Record<string, Function[]> = {};
    return {
      data: { userId },
      on: jest.fn((event: string, handler: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      }),
    };
  }

  it('allows connections when Redis is healthy', async () => {
    redisIsDown = false;
    const socket = makeSocket();
    const next   = jest.fn();
    await wsRateLimitMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('allows connections when Redis is down (in-memory fallback)', async () => {
    redisIsDown = true;
    const socket = makeSocket('fallback-user');
    const next   = jest.fn();
    await wsRateLimitMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(); // still allowed — fallback kicks in
  });

  it('enforces connection rate limit via in-memory when Redis is down', async () => {
    redisIsDown = true;
    const next   = jest.fn();

    // Fire 12 connection attempts (limit is 10 per minute)
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const socket = makeSocket('storm-user');
      await wsRateLimitMiddleware(socket, (err?: Error) => {
        if (err) blocked = true;
      });
    }

    expect(blocked).toBe(true);
  });
});
