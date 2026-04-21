// src/services/matching/sessionManager.ts
// Fixed: atomic session creation with Redis SET NX to prevent duplicate sessions.

import { Session, ISession } from '../../models/Session';
import { redisClient, REDIS_KEYS } from '../../config/redis';
import { logger } from '../../utils/logger';
import { SessionType, SessionStatus } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IActiveSession {
  id:          string;
  sessionType: SessionType;
  user1Id:     string;
  user2Id:     string;
  startedAt:   number;
}

export class SessionManager {
  private readonly SESSION_TTL      = 7200; // 2 hours
  private readonly CLEANUP_INTERVAL = 300_000; // 5 min
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupJob();
  }

  // ── Create session ────────────────────────────────────────────────────────
  // Uses SET NX on a lock key so only one instance creates a session for a pair.

  async createSession(
    sessionType: SessionType,
    user1Id:     string,
    user2Id:     string
  ): Promise<ISession | null> {
    try {
      // Guard: both users must be session-free
      const [u1Session, u2Session] = await Promise.all([
        this.getActiveSession(user1Id),
        this.getActiveSession(user2Id),
      ]);
      if (u1Session || u2Session) {
        logger.warn(`Cannot create session — one or both users already in session`);
        return null;
      }

      // Atomic creation lock: prevents two instances from creating the same pair
      const pairKey = [user1Id, user2Id].sort().join(':');
      const lockKey = `lock:session:pair:${pairKey}`;
      const locked  = await redisClient.set(lockKey, '1', 'EX', 10, 'NX');
      if (!locked) {
        logger.warn(`Session creation already in progress for pair ${pairKey}`);
        return null;
      }

      try {
        const session = await Session.create(sessionType, user1Id, user2Id);
        if (!session) return null;

        const sessionData: IActiveSession = {
          id:          session.id,
          sessionType,
          user1Id,
          user2Id,
          startedAt:   Date.now(),
        };

        const pipeline = redisClient.pipeline();
        pipeline.setex(`${REDIS_KEYS.SESSION}${session.id}`,      this.SESSION_TTL, JSON.stringify(sessionData));
        pipeline.setex(`${REDIS_KEYS.SESSION_USER}${user1Id}`,    this.SESSION_TTL, session.id);
        pipeline.setex(`${REDIS_KEYS.SESSION_USER}${user2Id}`,    this.SESSION_TTL, session.id);
        await pipeline.exec();

        MetricsService.trackSessionStart(sessionType);
        logger.info(`Session created: ${session.id} (${sessionType})`);
        return session;
      } finally {
        await redisClient.del(lockKey);
      }
    } catch (error) {
      logger.error('Error creating session:', error);
      return null;
    }
  }

  // ── Get active session ────────────────────────────────────────────────────

  async getActiveSession(userId: string): Promise<IActiveSession | null> {
    try {
      const sessionId = await redisClient.get(`${REDIS_KEYS.SESSION_USER}${userId}`);
      if (!sessionId) return null;

      const sessionData = await redisClient.get(`${REDIS_KEYS.SESSION}${sessionId}`);
      if (!sessionData) {
        await redisClient.del(`${REDIS_KEYS.SESSION_USER}${userId}`);
        return null;
      }

      return JSON.parse(sessionData) as IActiveSession;
    } catch (error) {
      logger.error('Error getting active session:', error);
      return null;
    }
  }

  async getSessionById(sessionId: string): Promise<IActiveSession | null> {
    try {
      const data = await redisClient.get(`${REDIS_KEYS.SESSION}${sessionId}`);
      return data ? (JSON.parse(data) as IActiveSession) : null;
    } catch (error) {
      logger.error('Error getting session by ID:', error);
      return null;
    }
  }

  // ── End session ───────────────────────────────────────────────────────────

  async endSession(
    sessionId: string,
    status: SessionStatus = SessionStatus.ENDED
  ): Promise<boolean> {
    try {
      const sessionData = await this.getSessionById(sessionId);
      if (!sessionData) {
        logger.warn(`Session not found: ${sessionId}`);
        return false;
      }

      const durationSeconds = (Date.now() - sessionData.startedAt) / 1000;

      const updated = await Session.endSession(sessionId, status);
      if (updated) {
        const pipeline = redisClient.pipeline();
        pipeline.del(`${REDIS_KEYS.SESSION}${sessionId}`);
        pipeline.del(`${REDIS_KEYS.SESSION_USER}${sessionData.user1Id}`);
        pipeline.del(`${REDIS_KEYS.SESSION_USER}${sessionData.user2Id}`);
        await pipeline.exec();

        const reason =
          status === SessionStatus.ENDED     ? 'normal'     :
          status === SessionStatus.ABANDONED  ? 'timeout'    : 'disconnect';
        MetricsService.trackSessionEnd(sessionData.sessionType, reason, durationSeconds);
        logger.info(`Session ended: ${sessionId} (${status}, ${Math.round(durationSeconds)}s)`);
      }

      return updated;
    } catch (error) {
      logger.error('Error ending session:', error);
      return false;
    }
  }

  async endSessionForUser(userId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(userId);
      if (!session) return false;
      return this.endSession(session.id, SessionStatus.ENDED);
    } catch (error) {
      logger.error('Error ending session for user:', error);
      return false;
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async isUserInSession(userId: string): Promise<boolean> {
    return (await this.getActiveSession(userId)) !== null;
  }

  async getSessionPartner(userId: string): Promise<string | null> {
    try {
      const session = await this.getActiveSession(userId);
      if (!session) return null;
      return session.user1Id === userId ? session.user2Id : session.user1Id;
    } catch (error) {
      logger.error('Error getting session partner:', error);
      return null;
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      return Session.getActiveSessionsCount();
    } catch (error) {
      logger.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  async getActiveSessionsByType(): Promise<unknown> {
    try {
      return Session.getActiveSessionsByType();
    } catch (error) {
      logger.error('Error getting active sessions by type:', error);
      return { video: 0, audio: 0, text: 0 };
    }
  }

  async extendSessionTTL(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = `${REDIS_KEYS.SESSION}${sessionId}`;
      const exists = await redisClient.exists(sessionKey);
      if (!exists) return false;
      await redisClient.expire(sessionKey, this.SESSION_TTL);
      return true;
    } catch (error) {
      logger.error('Error extending session TTL:', error);
      return false;
    }
  }

  async getSessionStats(): Promise<unknown> {
    try {
      const [activeCounts, platformStats] = await Promise.all([
        this.getActiveSessionsByType(),
        Session.getPlatformStats(),
      ]);
      return { active: activeCounts, platform: platformStats, timestamp: Date.now() };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return null;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private async cleanupAbandonedSessions(): Promise<void> {
    try {
      const cleanedDb = await Session.cleanupAbandonedSessions(60);
      if (cleanedDb > 0) logger.info(`Cleaned ${cleanedDb} abandoned sessions from DB`);

      // Purge Redis keys whose DB session is no longer active
      const pattern = `${REDIS_KEYS.SESSION}*`;
      let cursor     = '0';
      let cleanedRedis = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;

        for (const key of keys) {
          const sessionId = key.replace(REDIS_KEYS.SESSION, '');
          const dbSession = await Session.findById(sessionId);
          if (!dbSession || dbSession.status !== SessionStatus.ACTIVE) {
            await redisClient.del(key);
            cleanedRedis++;
          }
        }
      } while (cursor !== '0');

      if (cleanedRedis > 0) logger.info(`Cleaned ${cleanedRedis} stale session keys from Redis`);
    } catch (error) {
      logger.error('Error in cleanup job:', error);
    }
  }

  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupAbandonedSessions(),
      this.CLEANUP_INTERVAL
    );
    logger.info('Session cleanup job started');
  }

  stopCleanupJob(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      logger.info('Session cleanup job stopped');
    }
  }

  async getAllActiveSessions(): Promise<IActiveSession[]> {
    try {
      const pattern  = `${REDIS_KEYS.SESSION}*`;
      let cursor     = '0';
      const sessions: IActiveSession[] = [];

      do {
        const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        for (const key of keys) {
          const data = await redisClient.get(key);
          if (data) sessions.push(JSON.parse(data) as IActiveSession);
        }
      } while (cursor !== '0');

      return sessions;
    } catch (error) {
      logger.error('Error getting all active sessions:', error);
      return [];
    }
  }

  async endAllActiveSessions(): Promise<number> {
    try {
      const sessions = await this.getAllActiveSessions();
      let count = 0;
      for (const s of sessions) {
        if (await this.endSession(s.id, SessionStatus.ABANDONED)) count++;
      }
      logger.info(`Ended ${count} active sessions`);
      return count;
    } catch (error) {
      logger.error('Error ending all active sessions:', error);
      return 0;
    }
  }
}

export default new SessionManager();
