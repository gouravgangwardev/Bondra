// src/services/matching/sessionManager.ts
import { Session, ISession } from '../../models/Session';
import { redisClient, RedisService, REDIS_KEYS } from '../../config/redis';
import { logger } from '../../utils/logger';
import { SessionType, SessionStatus } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IActiveSession {
  id: string;
  sessionType: SessionType;
  user1Id: string;
  user2Id: string;
  startedAt: number;
}

export class SessionManager {
  private readonly SESSION_TTL = 7200; // 2 hours in seconds
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupJob();
  }

  // Create new session
  async createSession(
    sessionType: SessionType,
    user1Id: string,
    user2Id: string
  ): Promise<ISession | null> {
    try {
      // Check if users already have active sessions
      const user1Session = await this.getActiveSession(user1Id);
      const user2Session = await this.getActiveSession(user2Id);

      if (user1Session || user2Session) {
        logger.warn('One or both users already in active session');
        return null;
      }

      // Create session in database
      const session = await Session.create(sessionType, user1Id, user2Id);

      if (!session) {
        return null;
      }

      // Store session in Redis for quick access
      const sessionData: IActiveSession = {
        id: session.id,
        sessionType,
        user1Id,
        user2Id,
        startedAt: Date.now(),
      };

      await Promise.all([
        // Store session data
        redisClient.setex(
          `${REDIS_KEYS.SESSION}${session.id}`,
          this.SESSION_TTL,
          JSON.stringify(sessionData)
        ),
        // Map users to session
        redisClient.setex(
          `${REDIS_KEYS.SESSION_USER}${user1Id}`,
          this.SESSION_TTL,
          session.id
        ),
        redisClient.setex(
          `${REDIS_KEYS.SESSION_USER}${user2Id}`,
          this.SESSION_TTL,
          session.id
        ),
      ]);

      // Update metrics
      MetricsService.trackSessionStart(sessionType);

      logger.info(`Session created: ${session.id} (${sessionType})`);

      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      return null;
    }
  }

  // Get active session for user
  async getActiveSession(userId: string): Promise<IActiveSession | null> {
    try {
      // Get session ID from user mapping
      const sessionId = await redisClient.get(`${REDIS_KEYS.SESSION_USER}${userId}`);

      if (!sessionId) {
        return null;
      }

      // Get session data
      const sessionData = await redisClient.get(`${REDIS_KEYS.SESSION}${sessionId}`);

      if (!sessionData) {
        // Clean up stale mapping
        await redisClient.del(`${REDIS_KEYS.SESSION_USER}${userId}`);
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error('Error getting active session:', error);
      return null;
    }
  }

  // Get session by ID from Redis
  async getSessionById(sessionId: string): Promise<IActiveSession | null> {
    try {
      const sessionData = await redisClient.get(`${REDIS_KEYS.SESSION}${sessionId}`);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error('Error getting session by ID:', error);
      return null;
    }
  }

  // End session
  async endSession(
    sessionId: string,
    status: SessionStatus = SessionStatus.ENDED
  ): Promise<boolean> {
    try {
      // Get session data
      const sessionData = await this.getSessionById(sessionId);

      if (!sessionData) {
        logger.warn(`Session not found: ${sessionId}`);
        return false;
      }

      // Calculate duration
      const durationSeconds = (Date.now() - sessionData.startedAt) / 1000;

      // Update session in database
      const updated = await Session.endSession(sessionId, status);

      if (updated) {
        // Remove from Redis
        await Promise.all([
          redisClient.del(`${REDIS_KEYS.SESSION}${sessionId}`),
          redisClient.del(`${REDIS_KEYS.SESSION_USER}${sessionData.user1Id}`),
          redisClient.del(`${REDIS_KEYS.SESSION_USER}${sessionData.user2Id}`),
        ]);

        // Update metrics
        const reason = status === SessionStatus.ENDED ? 'normal' : 
                       status === SessionStatus.ABANDONED ? 'timeout' : 'disconnect';
        MetricsService.trackSessionEnd(sessionData.sessionType, reason, durationSeconds);

        logger.info(`Session ended: ${sessionId} (${status}, ${durationSeconds}s)`);
      }

      return updated;
    } catch (error) {
      logger.error('Error ending session:', error);
      return false;
    }
  }

  // End session for user (when they disconnect)
  async endSessionForUser(userId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(userId);

      if (!session) {
        return false;
      }

      return await this.endSession(session.id, SessionStatus.ENDED);
    } catch (error) {
      logger.error('Error ending session for user:', error);
      return false;
    }
  }

  // Check if user is in active session
  async isUserInSession(userId: string): Promise<boolean> {
    try {
      const session = await this.getActiveSession(userId);
      return session !== null;
    } catch (error) {
      logger.error('Error checking if user in session:', error);
      return false;
    }
  }

  // Get partner in session
  async getSessionPartner(userId: string): Promise<string | null> {
    try {
      const session = await this.getActiveSession(userId);

      if (!session) {
        return null;
      }

      return session.user1Id === userId ? session.user2Id : session.user1Id;
    } catch (error) {
      logger.error('Error getting session partner:', error);
      return null;
    }
  }

  // Get active sessions count
  async getActiveSessionsCount(): Promise<number> {
    try {
      // Get count from database for accuracy
      return await Session.getActiveSessionsCount();
    } catch (error) {
      logger.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  // Get active sessions by type
  async getActiveSessionsByType(): Promise<any> {
    try {
      return await Session.getActiveSessionsByType();
    } catch (error) {
      logger.error('Error getting active sessions by type:', error);
      return { video: 0, audio: 0, text: 0 };
    }
  }

  // Extend session TTL (when users are active)
  async extendSessionTTL(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = `${REDIS_KEYS.SESSION}${sessionId}`;
      
      // Check if session exists
      const exists = await redisClient.exists(sessionKey);
      
      if (!exists) {
        return false;
      }

      // Extend TTL
      await redisClient.expire(sessionKey, this.SESSION_TTL);

      return true;
    } catch (error) {
      logger.error('Error extending session TTL:', error);
      return false;
    }
  }

  // Get session statistics
  async getSessionStats(): Promise<any> {
    try {
      const [activeCounts, platformStats] = await Promise.all([
        this.getActiveSessionsByType(),
        Session.getPlatformStats(),
      ]);

      return {
        active: activeCounts,
        platform: platformStats,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return null;
    }
  }

  // Cleanup abandoned sessions
  private async cleanupAbandonedSessions(): Promise<void> {
    try {
      // Clean up from database (sessions active for more than 1 hour)
      const cleanedDb = await Session.cleanupAbandonedSessions(60);

      if (cleanedDb > 0) {
        logger.info(`Cleaned up ${cleanedDb} abandoned sessions from database`);
      }

      // Clean up Redis entries without corresponding database sessions
      const pattern = `${REDIS_KEYS.SESSION}*`;
      let cursor = '0';
      let cleanedRedis = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
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

      if (cleanedRedis > 0) {
        logger.info(`Cleaned up ${cleanedRedis} stale session entries from Redis`);
      }
    } catch (error) {
      logger.error('Error in cleanup job:', error);
    }
  }

  // Start cleanup job
  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupAbandonedSessions();
    }, this.CLEANUP_INTERVAL);

    logger.info('Session cleanup job started');
  }

  // Stop cleanup job
  stopCleanupJob(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      logger.info('Session cleanup job stopped');
    }
  }

  // Get all active sessions (for admin)
  async getAllActiveSessions(): Promise<IActiveSession[]> {
    try {
      const pattern = `${REDIS_KEYS.SESSION}*`;
      let cursor = '0';
      const sessions: IActiveSession[] = [];

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const sessionData = await redisClient.get(key);
          if (sessionData) {
            sessions.push(JSON.parse(sessionData));
          }
        }
      } while (cursor !== '0');

      return sessions;
    } catch (error) {
      logger.error('Error getting all active sessions:', error);
      return [];
    }
  }

  // Force end all active sessions (for maintenance)
  async endAllActiveSessions(): Promise<number> {
    try {
      const sessions = await this.getAllActiveSessions();
      let count = 0;

      for (const session of sessions) {
        const ended = await this.endSession(session.id, SessionStatus.ABANDONED);
        if (ended) count++;
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