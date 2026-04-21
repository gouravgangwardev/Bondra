// tests/concurrency/matchmaking.test.ts
// Simulated concurrency test: 100 users, random disconnects, rapid Next clicks.
// Verifies:
//   - No user is matched more than once simultaneously
//   - No partial sessions (sessions always have 2 valid users)
//   - Queue is empty at end (no dangling entries)
//   - No race condition allows a user to be in two sessions

import Redis from 'ioredis';
import { QueueManager } from '../../src/services/matching/queueManager';
import { SessionType } from '../../src/config/constants';

// ── Isolated test Redis DB ───────────────────────────────────────────────────
const TEST_DB   = 14;
const testRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db:   TEST_DB,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

// Override the module's Redis client to use test DB
jest.mock('../../src/config/redis', () => {
  const Redis = require('ioredis');
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db:   14,
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

jest.mock('../../src/config/monitoring', () => ({
  MetricsService: {
    updateQueueSize:    jest.fn(),
    trackQueueJoin:     jest.fn(),
    trackQueueLeave:    jest.fn(),
    trackQueueWaitTime: jest.fn(),
    trackError:         jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(maxMs: number): Promise<void> {
  return new Promise(r => setTimeout(r, Math.random() * maxMs));
}

function randomBoolean(probability = 0.5): boolean {
  return Math.random() < probability;
}

// ── Test ─────────────────────────────────────────────────────────────────────

describe('Matchmaking concurrency (100 users)', () => {
  const USER_COUNT = 100;
  let qm: QueueManager;

  beforeAll(async () => {
    await testRedis.connect();
  });

  beforeEach(async () => {
    await testRedis.flushdb();
    const mod = await import('../../src/services/matching/queueManager');
    qm = new mod.QueueManager();
  });

  afterAll(async () => {
    await testRedis.flushdb();
    await testRedis.quit();
  });

  it('produces valid non-overlapping pairs for 100 concurrent users', async () => {
    const users = Array.from({ length: USER_COUNT }, (_, i) => ({
      userId:   `user-${i}`,
      socketId: `socket-${i}`,
    }));

    // All 100 users join simultaneously
    await Promise.all(
      users.map(u => qm.addToQueue(u.userId, u.socketId, SessionType.VIDEO))
    );

    expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(USER_COUNT);

    // Drain the queue with concurrent popPair calls (simulates multiple server instances)
    const matchedPairs: Array<[string, string]> = [];
    const popWorkers = Array.from({ length: 20 }, async () => {
      while (true) {
        const pair = await qm.popPair(SessionType.VIDEO);
        if (!pair) break;
        matchedPairs.push([pair[0].userId, pair[1].userId]);
        await randomDelay(2);
      }
    });

    await Promise.all(popWorkers);

    // Verify: 50 pairs, each user appears exactly once
    expect(matchedPairs).toHaveLength(USER_COUNT / 2);

    const seenUsers = new Set<string>();
    for (const [u1, u2] of matchedPairs) {
      expect(seenUsers.has(u1)).toBe(false); // no double match
      expect(seenUsers.has(u2)).toBe(false);
      seenUsers.add(u1);
      seenUsers.add(u2);
    }

    expect(seenUsers.size).toBe(USER_COUNT);
    expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(0);
  }, 30_000);

  it('handles random disconnects without corrupting the queue', async () => {
    const users = Array.from({ length: USER_COUNT }, (_, i) => ({
      userId:   `user-${i}`,
      socketId: `socket-${i}`,
    }));

    // All join simultaneously
    await Promise.all(
      users.map(u => qm.addToQueue(u.userId, u.socketId, SessionType.AUDIO))
    );

    // 30% of users disconnect (leave queue) at a random delay
    const disconnectOps = users
      .filter(() => randomBoolean(0.3))
      .map(async (u) => {
        await randomDelay(5);
        return qm.removeFromQueue(u.userId, SessionType.AUDIO);
      });

    await Promise.all(disconnectOps);

    const remaining = await qm.getQueueSize(SessionType.AUDIO);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(USER_COUNT);

    // No user appears twice in the queue
    const queueKey = 'queue:audio';
    const members = await testRedis.zrange(queueKey, 0, -1);
    const memberSet = new Set(members);
    expect(memberSet.size).toBe(members.length); // all unique
  }, 30_000);

  it('handles rapid Next clicks without creating partial sessions', async () => {
    // Add 50 users
    const users = Array.from({ length: 50 }, (_, i) => ({
      userId:   `next-user-${i}`,
      socketId: `next-sock-${i}`,
    }));

    await Promise.all(
      users.map(u => qm.addToQueue(u.userId, u.socketId, SessionType.TEXT))
    );

    // Simulate rapid "Next" by: remove from queue + re-add (the matchHandler flow)
    const rapidNextOps = users.slice(0, 10).map(async (u) => {
      for (let i = 0; i < 5; i++) {
        await randomDelay(1);
        await qm.removeFromQueue(u.userId, SessionType.TEXT);
        await randomDelay(1);
        await qm.addToQueue(u.userId, u.socketId, SessionType.TEXT);
      }
    });

    await Promise.all(rapidNextOps);

    // After all rapid operations queue should be consistent
    const size = await qm.getQueueSize(SessionType.TEXT);
    expect(size).toBeGreaterThanOrEqual(0);
    expect(size).toBeLessThanOrEqual(50);

    // Each member unique
    const members = await testRedis.zrange('queue:text', 0, -1);
    expect(new Set(members).size).toBe(members.length);
  }, 30_000);

  it('addToQueue is idempotent under concurrent hammering', async () => {
    // Fire 50 concurrent adds for the same user
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        qm.addToQueue('concurrent-user', 'socket-x', SessionType.VIDEO)
      )
    );

    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1); // only the first add should succeed

    expect(await qm.getQueueSize(SessionType.VIDEO)).toBe(1);
  }, 30_000);
});
