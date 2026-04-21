// src/services/matching/pairingEngine.ts
// Background loop uses atomic popPair() — no distributed lock needed.

import queueManager, { IQueueUser } from './queueManager';
import sessionManager from './sessionManager';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';
import { RedisService, REDIS_CHANNELS, redisClient } from '../../config/redis';

export interface IMatchResult {
  success:    boolean;
  sessionId?: string;
  partner?:   IQueueUser;
  error?:     string;
}

// ── Per-queue-type matching lock ─────────────────────────────────────────────
// Ensures that quickMatch() and processQueue() never simultaneously pop+create
// for the same queue type, preventing duplicate session creation and re-push
// interference. TTL is generous to cover session creation latency.

const MATCH_LOCK_KEY = (type: SessionType) => `pairing:lock:${type}`;
const MATCH_LOCK_TTL = 5; // seconds

async function acquireMatchLock(type: SessionType): Promise<boolean> {
  const result = await redisClient.set(MATCH_LOCK_KEY(type), '1', 'EX', MATCH_LOCK_TTL, 'NX');
  return result === 'OK';
}

async function releaseMatchLock(type: SessionType): Promise<void> {
  await redisClient.del(MATCH_LOCK_KEY(type));
}

/**
 * Re-queue a pair that was atomically popped but should not be consumed by the
 * current operation (e.g. neither user is the joining user in quickMatch).
 *
 * Uses direct Redis ops instead of queueManager.addToQueue() so that:
 *  1. Original joinedAt timestamps — and therefore queue positions — are preserved.
 *  2. The idempotency guard in addToQueue() cannot silently drop the re-push.
 */
async function requeuePair(
  u1:        IQueueUser,
  u2:        IQueueUser,
  queueKey:  string
): Promise<void> {
  const pipeline = redisClient.pipeline();
  pipeline.set(`queue:user:${u1.userId}`, JSON.stringify(u1), 'EX', 120);
  pipeline.zadd(queueKey, u1.joinedAt, u1.userId);
  pipeline.set(`queue:user:${u2.userId}`, JSON.stringify(u2), 'EX', 120);
  pipeline.zadd(queueKey, u2.joinedAt, u2.userId);
  await pipeline.exec();
}

export class PairingEngine {
  private matchingIntervals: Map<SessionType, NodeJS.Timeout> = new Map();
  private isRunning = false;

  // ── Background loop ─────────────────────────────────────────────────────────

  start(intervalMs = 2000): void {
    if (this.isRunning) {
      logger.warn('Pairing engine already running');
      return;
    }
    this.isRunning = true;

    for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
      const interval = setInterval(() => {
        this.processQueue(type).catch(err =>
          logger.error(`Error processing ${type} queue:`, err)
        );
      }, intervalMs);
      this.matchingIntervals.set(type, interval);
    }

    logger.info('Pairing engine started');
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    for (const interval of this.matchingIntervals.values()) {
      clearInterval(interval);
    }
    this.matchingIntervals.clear();
    logger.info('Pairing engine stopped');
  }

  // Drain the queue in batches — each popPair() is atomic, no lock needed.
  // Acquires per-queue match lock so it does not race with quickMatch().
  private async processQueue(queueType: SessionType): Promise<void> {
    while (true) {
      // ── Acquire lock — skip this tick if quickMatch() is in progress ─────
      const locked = await acquireMatchLock(queueType);
      if (!locked) {
        logger.debug(`processQueue: lock busy for ${queueType}, skipping tick`);
        break;
      }

      try {
        const pair = await queueManager.popPair(queueType);
        if (!pair) break; // queue has < 2 users

        const [user1, user2] = pair;

        const session = await sessionManager.createSession(queueType, user1.userId, user2.userId);
        if (!session) {
          // Re-push both users on session creation failure (preserves timestamps)
          const queueKey = this.getQueueKey(queueType);
          await requeuePair(user1, user2, queueKey);
          MetricsService.trackError('matching', 'session_creation_failed');
          break; // avoid tight loop on persistent DB errors
        }

        await RedisService.publish(REDIS_CHANNELS.MATCH_FOUND, {
          sessionId:   session.id,
          user1Id:     user1.userId,
          user2Id:     user2.userId,
          sessionType: queueType,
        });

        MetricsService.trackQueueLeave(queueType, 'matched');
        logger.info(
          `PairingEngine matched: ${user1.userId} <-> ${user2.userId} | session ${session.id} | ${queueType}`
        );
      } finally {
        await releaseMatchLock(queueType);
      }
    }
  }

  // ── Direct quick-match (called from matchHandler on QUEUE_JOIN) ─────────────
  // Acquires the same per-queue lock as processQueue() so only ONE path can
  // pop+create at a time for a given queue type.

  async quickMatch(
    userId:    string,
    socketId:  string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      const added = await queueManager.addToQueue(userId, socketId, queueType);
      if (!added) {
        // User was already in queue — still return waiting
        return { success: false, error: 'Waiting for match' };
      }

      // ── Acquire lock — if processQueue is running, let it handle the match ──
      const locked = await acquireMatchLock(queueType);
      if (!locked) {
        // Background loop currently has the lock; user stays in queue and will
        // be matched on the next processQueue tick (≤2 s).
        logger.debug(`quickMatch: lock busy for ${queueType}, user ${userId} will wait`);
        return { success: false, error: 'Waiting for match' };
      }

      try {
        // Single immediate attempt — use popPair but only if we're one of the two
        const pair = await queueManager.popPair(queueType);
        if (!pair) {
          // No immediate match — stay in queue for background loop
          return { success: false, error: 'Waiting for match' };
        }

        const [u1, u2] = pair;

        // If neither is our user, re-push with ORIGINAL timestamps and wait.
        // Using requeuePair() instead of addToQueue() preserves queue order and
        // prevents the re-push loop where repeated quickMatch calls keep evicting
        // the same unrelated pair.
        if (u1.userId !== userId && u2.userId !== userId) {
          const queueKey = this.getQueueKey(queueType);
          await requeuePair(u1, u2, queueKey);
          return { success: false, error: 'Waiting for match' };
        }

        const partner = u1.userId === userId ? u2 : u1;

        const session = await sessionManager.createSession(queueType, userId, partner.userId);
        if (!session) {
          // Re-queue both on failure, preserving original timestamps
          const queueKey = this.getQueueKey(queueType);
          await requeuePair(
            u1.userId === userId ? u1 : u2,  // self
            partner,
            queueKey
          );
          return { success: false, error: 'Failed to create session' };
        }

        MetricsService.trackQueueLeave(queueType, 'matched');
        logger.info(`Quick match: ${userId} <-> ${partner.userId} (${queueType})`);

        return { success: true, sessionId: session.id, partner };
      } finally {
        await releaseMatchLock(queueType);
      }
    } catch (error) {
      logger.error('Error in quickMatch:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  // ── Cancel matching ─────────────────────────────────────────────────────────

  async cancelMatching(userId: string, queueType: SessionType): Promise<boolean> {
    try {
      const removed = await queueManager.removeFromQueue(userId, queueType);
      if (removed) {
        MetricsService.trackQueueLeave(queueType, 'cancelled');
        logger.info(`User ${userId} cancelled matching in ${queueType}`);
      }
      return removed;
    } catch (error) {
      logger.error('Error cancelling matching:', error);
      return false;
    }
  }

  // ── Status query ────────────────────────────────────────────────────────────

  async getMatchingStatus(userId: string): Promise<{
    inQueue:            boolean;
    queueType?:         SessionType;
    position?:          number;
    estimatedWaitTime?: number;
  }> {
    try {
      const inQueue = await queueManager.isUserInQueue(userId);
      if (!inQueue.inQueue || !inQueue.queueType) return { inQueue: false };

      const position = await queueManager.getQueuePosition(userId, inQueue.queueType);
      const estimatedWaitTime = Math.max(0, (position - 1) * 5);

      return { inQueue: true, queueType: inQueue.queueType, position, estimatedWaitTime };
    } catch (error) {
      logger.error('Error getting matching status:', error);
      return { inQueue: false };
    }
  }

  // ── Friend matching ─────────────────────────────────────────────────────────

  async matchWithFriend(
    userId:    string,
    friendId:  string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      const [userSession, friendSession] = await Promise.all([
        sessionManager.getActiveSession(userId),
        sessionManager.getActiveSession(friendId),
      ]);

      if (userSession || friendSession) {
        return { success: false, error: 'One or both users are already in a session' };
      }

      const session = await sessionManager.createSession(queueType, userId, friendId);
      if (!session) return { success: false, error: 'Failed to create session' };

      logger.info(`Friend match: ${userId} <-> ${friendId} (${queueType})`);
      return { success: true, sessionId: session.id };
    } catch (error) {
      logger.error('Error matching with friend:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  // ── Rematch (Next button) ───────────────────────────────────────────────────

  async rematch(userId: string, socketId: string, queueType: SessionType): Promise<IMatchResult> {
    try {
      const currentSession = await sessionManager.getActiveSession(userId);
      if (currentSession) {
        await sessionManager.endSession(currentSession.id);
      }
      await queueManager.removeFromAllQueues(userId);
      return this.quickMatch(userId, socketId, queueType);
    } catch (error) {
      logger.error('Error in rematch:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  // ── Force match (admin/test) ────────────────────────────────────────────────

  async forceMatch(user1Id: string, user2Id: string, queueType: SessionType): Promise<IMatchResult> {
    try {
      await Promise.all([
        queueManager.removeFromAllQueues(user1Id),
        queueManager.removeFromAllQueues(user2Id),
      ]);

      const session = await sessionManager.createSession(queueType, user1Id, user2Id);
      if (!session) return { success: false, error: 'Failed to create session' };

      logger.info(`Force match: ${user1Id} <-> ${user2Id} (${queueType})`);
      return { success: true, sessionId: session.id };
    } catch (error) {
      logger.error('Error in force match:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  async getStats(): Promise<unknown> {
    try {
      return {
        queues:    await queueManager.getQueueStats(),
        isRunning: this.isRunning,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting pairing stats:', error);
      return null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private getQueueKey(queueType: SessionType): string {
    // Mirror queueManager's private getQueueKey for direct Redis access in requeuePair
    const { REDIS_KEYS } = require('../../config/redis');
    switch (queueType) {
      case SessionType.VIDEO: return REDIS_KEYS.QUEUE_VIDEO;
      case SessionType.AUDIO: return REDIS_KEYS.QUEUE_AUDIO;
      case SessionType.TEXT:  return REDIS_KEYS.QUEUE_TEXT;
      default:                return REDIS_KEYS.QUEUE_VIDEO;
    }
  }
}

export default new PairingEngine();