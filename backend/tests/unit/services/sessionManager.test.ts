// tests/unit/services/sessionManager.test.ts

import { SessionManager, IActiveSession } from '../../../src/services/matching/sessionManager';
import { SessionType, SessionStatus } from '../../../src/config/constants';

// ── Mock Redis ─────────────────────────────────────────────────────────────
const mockStore = new Map<string, string>();
const mockRedis = {
  get:    jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  set:    jest.fn((k: string, v: string, ...rest: unknown[]) => { mockStore.set(k, v); return Promise.resolve('OK'); }),
  setex:  jest.fn((k: string, _ttl: number, v: string) => { mockStore.set(k, v); return Promise.resolve('OK'); }),
  del:    jest.fn((...keys: string[]) => { keys.forEach(k => mockStore.delete(k)); return Promise.resolve(keys.length); }),
  exists: jest.fn((k: string) => Promise.resolve(mockStore.has(k) ? 1 : 0)),
  expire: jest.fn(() => Promise.resolve(1)),
  scan:   jest.fn(() => Promise.resolve(['0', []])),
  pipeline: jest.fn(() => ({
    setex: jest.fn().mockReturnThis(),
    del:   jest.fn().mockReturnThis(),
    exec:  jest.fn().mockResolvedValue([]),
  })),
};

jest.mock('../../../src/config/redis', () => ({
  redisClient: mockRedis,
  REDIS_KEYS: {
    SESSION:      'session:',
    SESSION_USER: 'session:user:',
    LOCK_SESSION: 'lock:session:',
  },
  RedisService: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock DB Session model ──────────────────────────────────────────────────
let sessionIdCounter = 0;
const mockSession = {
  create:                    jest.fn(),
  findById:                  jest.fn(),
  endSession:                jest.fn().mockResolvedValue(true),
  getActiveSessionsCount:    jest.fn().mockResolvedValue(0),
  getActiveSessionsByType:   jest.fn().mockResolvedValue({ video: 0, audio: 0, text: 0 }),
  getPlatformStats:          jest.fn().mockResolvedValue({}),
  cleanupAbandonedSessions:  jest.fn().mockResolvedValue(0),
};
jest.mock('../../../src/models/Session', () => ({ Session: mockSession }));

jest.mock('../../../src/config/monitoring', () => ({
  MetricsService: {
    trackSessionStart: jest.fn(),
    trackSessionEnd:   jest.fn(),
    trackError:        jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('SessionManager', () => {
  let sm: SessionManager;

  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
    sessionIdCounter = 0;

    mockSession.create.mockImplementation((type: SessionType, u1: string, u2: string) => {
      const id = `session-${++sessionIdCounter}`;
      return Promise.resolve({ id, session_type: type, user1_id: u1, user2_id: u2, status: 'active' });
    });
    mockSession.findById.mockImplementation((id: string) => {
      return Promise.resolve({ id, status: 'active' });
    });

    sm = new SessionManager();
    // Prevent cleanup timer from running during tests
    sm.stopCleanupJob();
  });

  // ── createSession ──────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session and stores it in Redis', async () => {
      const session = await sm.createSession(SessionType.VIDEO, 'user-1', 'user-2');

      expect(session).not.toBeNull();
      expect(session!.id).toBeDefined();
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('refuses to create a session if user-1 already has one', async () => {
      // Simulate user-1 already in a session
      mockStore.set('session:user:user-1', 'existing-session-id');
      mockStore.set('session:existing-session-id', JSON.stringify({
        id: 'existing-session-id',
        user1Id: 'user-1', user2Id: 'user-3',
        sessionType: SessionType.VIDEO, startedAt: Date.now(),
      } as IActiveSession));

      const session = await sm.createSession(SessionType.VIDEO, 'user-1', 'user-2');
      expect(session).toBeNull();
    });

    it('refuses to create a session if user-2 already has one', async () => {
      mockStore.set('session:user:user-2', 'existing-session-id');
      mockStore.set('session:existing-session-id', JSON.stringify({
        id: 'existing-session-id',
        user1Id: 'user-3', user2Id: 'user-2',
        sessionType: SessionType.VIDEO, startedAt: Date.now(),
      } as IActiveSession));

      const session = await sm.createSession(SessionType.VIDEO, 'user-1', 'user-2');
      expect(session).toBeNull();
    });

    it('prevents duplicate creation for the same pair via lock', async () => {
      // Both calls race — second one should get null because lock is held
      const { RedisService } = require('../../../src/config/redis');
      let lockCount = 0;
      (RedisService.acquireLock as jest.Mock).mockImplementation(() => {
        lockCount++;
        return Promise.resolve(lockCount === 1); // only first caller gets lock
      });

      const [s1, s2] = await Promise.all([
        sm.createSession(SessionType.VIDEO, 'user-1', 'user-2'),
        sm.createSession(SessionType.VIDEO, 'user-1', 'user-2'),
      ]);

      const successCount = [s1, s2].filter(Boolean).length;
      expect(successCount).toBe(1);
    });
  });

  // ── getActiveSession ───────────────────────────────────────────────────────

  describe('getActiveSession', () => {
    it('returns null for user with no session', async () => {
      const result = await sm.getActiveSession('no-session-user');
      expect(result).toBeNull();
    });

    it('returns session data for a user with an active session', async () => {
      const data: IActiveSession = {
        id: 'sess-abc', sessionType: SessionType.TEXT,
        user1Id: 'user-1', user2Id: 'user-2', startedAt: Date.now(),
      };
      mockStore.set('session:user:user-1', 'sess-abc');
      mockStore.set('session:sess-abc', JSON.stringify(data));

      const result = await sm.getActiveSession('user-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('sess-abc');
    });

    it('cleans up stale user→session mapping when session data missing', async () => {
      mockStore.set('session:user:orphan-user', 'missing-session-id');
      // No session:missing-session-id key

      const result = await sm.getActiveSession('orphan-user');
      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('session:user:orphan-user')
      );
    });
  });

  // ── endSession ─────────────────────────────────────────────────────────────

  describe('endSession', () => {
    it('ends a session and removes Redis keys', async () => {
      const data: IActiveSession = {
        id: 'sess-end', sessionType: SessionType.AUDIO,
        user1Id: 'user-1', user2Id: 'user-2', startedAt: Date.now() - 5000,
      };
      mockStore.set('session:sess-end', JSON.stringify(data));

      const result = await sm.endSession('sess-end', SessionStatus.ENDED);
      expect(result).toBe(true);
      expect(mockSession.endSession).toHaveBeenCalledWith('sess-end', SessionStatus.ENDED);
    });

    it('returns false for a non-existent session', async () => {
      const result = await sm.endSession('ghost-session', SessionStatus.ENDED);
      expect(result).toBe(false);
    });
  });

  // ── getSessionPartner ──────────────────────────────────────────────────────

  describe('getSessionPartner', () => {
    it('returns correct partner for user-1', async () => {
      const data: IActiveSession = {
        id: 'sess-p', sessionType: SessionType.VIDEO,
        user1Id: 'user-1', user2Id: 'user-2', startedAt: Date.now(),
      };
      mockStore.set('session:user:user-1', 'sess-p');
      mockStore.set('session:sess-p', JSON.stringify(data));

      expect(await sm.getSessionPartner('user-1')).toBe('user-2');
    });

    it('returns correct partner for user-2', async () => {
      const data: IActiveSession = {
        id: 'sess-p2', sessionType: SessionType.VIDEO,
        user1Id: 'user-1', user2Id: 'user-2', startedAt: Date.now(),
      };
      mockStore.set('session:user:user-2', 'sess-p2');
      mockStore.set('session:sess-p2', JSON.stringify(data));

      expect(await sm.getSessionPartner('user-2')).toBe('user-1');
    });

    it('returns null if user has no session', async () => {
      expect(await sm.getSessionPartner('nobody')).toBeNull();
    });
  });
});
