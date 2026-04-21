// tests/unit/services/queueManager.test.ts
// Uses a real Redis connection on DB 15 — requires Redis to be running.

import Redis from 'ioredis';
import { QueueManager, IQueueUser } from '../../../src/services/matching/queueManager';
import { SessionType } from '../../../src/config/constants';

// ── Test Redis client (DB 15 so we don't clobber dev data) ──────────────────
const testRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: 15,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

// Inject the test client into the module
jest.mock('../../../src/config/redis', () => {
  const Redis = require('ioredis');
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 15,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  });
  return {
    redisClient: client,
    REDIS_KEYS: {
      QUEUE_VIDEO:   'queue:video',
      QUEUE_AUDIO:   'queue:audio',
      QUEUE_TEXT:    'queue:text',
      LOCK_MATCHING: 'lock:matching:',
      LOCK_SESSION:  'lock:session:',
      SESSION:       'session:',
      SESSION_USER:  'session:user:',
      SOCKET_USER:   'socket:user:',
    },
    RedisService: {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../../../src/config/monitoring', () => ({
  MetricsService: {
    updateQueueSize:   jest.fn(),
    trackQueueJoin:    jest.fn(),
    trackQueueLeave:   jest.fn(),
    trackQueueWaitTime: jest.fn(),
    trackError:        jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('QueueManager', () => {
  let qm: QueueManager;

  beforeAll(async () => {
    await testRedis.connect();
  });

  beforeEach(async () => {
    await testRedis.flushdb();
    // Re-import so the mocked redisClient is the test one
    const mod = await import('../../../src/services/matching/queueManager');
    qm = new mod.QueueManager();
  });

  afterAll(async () => {
    await testRedis.flushdb();
    await testRedis.quit();
  });

  // ── addToQueue ─────────────────────────────────────────────────────────────

  describe('addToQueue', () => {
    it('adds a user to the queue', async () => {
      const result = await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      expect(result).toBe(true);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(1);
    });

    it('rejects a duplicate add for the same user in the same queue', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      const result = await qm.addToQueue('user-1', 'socket-2', SessionType.VIDEO);
      expect(result).toBe(false);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(1);
    });

    it('rejects a user already in a different queue type', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      const result = await qm.addToQueue('user-1', 'socket-1', SessionType.AUDIO);
      expect(result).toBe(false);
    });

    it('allows different users in the same queue', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      await qm.addToQueue('user-2', 'socket-2', SessionType.VIDEO);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(2);
    });
  });

  // ── popPair (atomic) ────────────────────────────────────────────────────────

  describe('popPair', () => {
    it('returns null when queue has fewer than 2 users', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      const pair = await qm.popPair(SessionType.VIDEO);
      expect(pair).toBeNull();
      // user-1 must still be in the queue
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(1);
    });

    it('atomically pops exactly 2 users', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      await qm.addToQueue('user-2', 'socket-2', SessionType.VIDEO);

      const pair = await qm.popPair(SessionType.VIDEO);
      expect(pair).not.toBeNull();
      expect(pair).toHaveLength(2);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(0);
    });

    it('pops oldest-first (FIFO order)', async () => {
      // Add user-1 first (older timestamp)
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      await new Promise(r => setTimeout(r, 5)); // ensure different timestamp
      await qm.addToQueue('user-2', 'socket-2', SessionType.VIDEO);

      const pair = await qm.popPair(SessionType.VIDEO);
      expect(pair).not.toBeNull();
      const userIds = pair!.map((u: IQueueUser) => u.userId);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
    });

    it('handles concurrent pops without double-matching', async () => {
      // Add exactly 2 users
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      await qm.addToQueue('user-2', 'socket-2', SessionType.VIDEO);

      // Fire two concurrent pops
      const [pair1, pair2] = await Promise.all([
        qm.popPair(SessionType.VIDEO),
        qm.popPair(SessionType.VIDEO),
      ]);

      // Exactly one pop should succeed
      const successCount = [pair1, pair2].filter(p => p !== null).length;
      expect(successCount).toBe(1);

      // Queue must be empty
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(0);
    });
  });

  // ── removeFromQueue ────────────────────────────────────────────────────────

  describe('removeFromQueue', () => {
    it('removes a user from the queue', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      const removed = await qm.removeFromQueue('user-1', SessionType.VIDEO);
      expect(removed).toBe(true);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(0);
    });

    it('returns false for a user not in queue', async () => {
      const removed = await qm.removeFromQueue('nonexistent', SessionType.VIDEO);
      expect(removed).toBe(false);
    });
  });

  // ── isUserInQueue ──────────────────────────────────────────────────────────

  describe('isUserInQueue', () => {
    it('detects a queued user', async () => {
      await qm.addToQueue('user-1', 'socket-1', SessionType.AUDIO);
      const status = await qm.isUserInQueue('user-1');
      expect(status.inQueue).toBe(true);
      expect(status.queueType).toBe(SessionType.AUDIO);
    });

    it('returns false for user not in any queue', async () => {
      const status = await qm.isUserInQueue('ghost');
      expect(status.inQueue).toBe(false);
    });
  });

  // ── cleanupStaleEntries ────────────────────────────────────────────────────

  describe('cleanupStaleEntries', () => {
    it('removes entries older than QUEUE_TIMEOUT', async () => {
      // Manually insert a stale entry with old timestamp
      const oldTs = Date.now() - 120_000; // 2 min ago
      await testRedis.zadd('queue:video', oldTs, 'stale-user');
      await testRedis.set(`queue:user:stale-user`, JSON.stringify({
        userId: 'stale-user', socketId: 'x', joinedAt: oldTs,
      }), 'EX', 120);

      // Add a fresh user
      await qm.addToQueue('fresh-user', 'socket-fresh', SessionType.VIDEO);

      const removed = await qm.cleanupStaleEntries();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(1);
    });
  });
});
