// src/services/matching/queueManager.ts
import { redisClient, RedisService, REDIS_KEYS } from '../../config/redis';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IQueueUser {
  userId: string;
  socketId: string;
  joinedAt: number;
}

export class QueueManager {
  private readonly QUEUE_TIMEOUT = 60000; // 60 seconds

  // Add user to queue
  async addToQueue(
    userId: string,
    socketId: string,
    queueType: SessionType
  ): Promise<boolean> {
    try {
      const queueKey = this.getQueueKey(queueType);
      const timestamp = Date.now();

      // Check if user is already in queue
      const existingScore = await redisClient.zscore(queueKey, userId);
      if (existingScore) {
        logger.warn(`User ${userId} already in ${queueType} queue`);
        return false;
      }

      // Store user data
      const userData: IQueueUser = { userId, socketId, joinedAt: timestamp };

      await redisClient.set(
        `queue:user:${userId}`,
        JSON.stringify(userData),
        'EX',
        120 // 2 minutes expiry
      );

      // Add to sorted set with timestamp as score
      await redisClient.zadd(queueKey, timestamp, userId);

      // Update metrics
      const queueSize = await this.getQueueSize(queueType);
      MetricsService.updateQueueSize(queueType, queueSize);
      MetricsService.trackQueueJoin(queueType);

      logger.info(`User ${userId} added to ${queueType} queue`);
      return true;
    } catch (error) {
      logger.error('Error adding to queue:', error);
      return false;
    }
  }

  // Remove user from queue
  async removeFromQueue(userId: string, queueType: SessionType): Promise<boolean> {
    try {
      const queueKey = this.getQueueKey(queueType);

      // Get user data to track wait time
      const userData = await this.getUserData(userId);
      if (userData) {
        const waitTimeSeconds = (Date.now() - userData.joinedAt) / 1000;
        MetricsService.trackQueueWaitTime(queueType, waitTimeSeconds);
      }

      const removed = await redisClient.zrem(queueKey, userId);
      await redisClient.del(`queue:user:${userId}`);

      const queueSize = await this.getQueueSize(queueType);
      MetricsService.updateQueueSize(queueType, queueSize);

      if (removed > 0) {
        logger.info(`User ${userId} removed from ${queueType} queue`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error removing from queue:', error);
      return false;
    }
  }

  /**
   * Atomically pop two users from the queue and return them as a pair.
   *
   * Uses ZPOPMIN which is an atomic O(log N) operation — no distributed lock
   * needed and no TOCTOU race between a read and a separate remove step.
   * Returns null if fewer than 2 users are waiting.
   */
  async popPair(queueType: SessionType): Promise<[IQueueUser, IQueueUser] | null> {
    const queueKey = this.getQueueKey(queueType);

    try {
      // ZPOPMIN key count — pops the two lowest-score (oldest) members atomically
      // ioredis returns [member, score, member, score, ...]
      const result = await redisClient.zpopmin(queueKey, 2);

      // result has format [userId1, score1, userId2, score2]
      if (!result || result.length < 4) {
        // Not enough users; if we only popped 1, put them back
        if (result && result.length === 2) {
          const userId = result[0] as string;
          const score  = parseFloat(result[1] as string);
          await redisClient.zadd(queueKey, score, userId);
        }
        return null;
      }

      const userId1 = result[0] as string;
      const userId2 = result[2] as string;

      const [data1, data2] = await Promise.all([
        this.getUserData(userId1),
        this.getUserData(userId2),
      ]);

      if (!data1 || !data2) {
        // Partial miss — re-queue any recovered user and bail
        logger.warn(`Queue pair data missing: ${userId1}=${!!data1}, ${userId2}=${!!data2}`);
        if (data1) await this.addToQueue(data1.userId, data1.socketId, queueType);
        if (data2) await this.addToQueue(data2.userId, data2.socketId, queueType);
        return null;
      }

      // Clean up their data keys
      await Promise.all([
        redisClient.del(`queue:user:${userId1}`),
        redisClient.del(`queue:user:${userId2}`),
      ]);

      const queueSize = await this.getQueueSize(queueType);
      MetricsService.updateQueueSize(queueType, queueSize);

      logger.info(`Popped pair: ${userId1} <-> ${userId2} (${queueType})`);
      return [data1, data2];
    } catch (error) {
      logger.error('Error popping pair from queue:', error);
      return null;
    }
  }

  // Legacy findMatch kept for callers outside pairingEngine that still use it.
  // Internally delegates to popPair so there is no separate lock.
  async findMatch(userId: string, queueType: SessionType): Promise<IQueueUser | null> {
    const pair = await this.popPair(queueType);
    if (!pair) return null;

    const [user1, user2] = pair;

    // If userId was not one of the two popped, re-queue both and return null
    if (user1.userId !== userId && user2.userId !== userId) {
      await this.addToQueue(user1.userId, user1.socketId, queueType);
      await this.addToQueue(user2.userId, user2.socketId, queueType);
      return null;
    }

    const partner = user1.userId === userId ? user2 : user1;
    MetricsService.trackQueueLeave(queueType, 'matched');
    logger.info(`Match found: ${userId} <-> ${partner.userId} (${queueType})`);
    return partner;
  }

  // Get user data from Redis
  async getUserData(userId: string): Promise<IQueueUser | null> {
    try {
      const data = await redisClient.get(`queue:user:${userId}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error getting user data:', error);
      return null;
    }
  }

  // Get queue size
  async getQueueSize(queueType: SessionType): Promise<number> {
    try {
      const queueKey = this.getQueueKey(queueType);
      return await redisClient.zcard(queueKey);
    } catch (error) {
      logger.error('Error getting queue size:', error);
      return 0;
    }
  }

  // Get all queue sizes
  async getAllQueueSizes(): Promise<{ video: number; audio: number; text: number }> {
    try {
      const [video, audio, text] = await Promise.all([
        this.getQueueSize(SessionType.VIDEO),
        this.getQueueSize(SessionType.AUDIO),
        this.getQueueSize(SessionType.TEXT),
      ]);
      return { video, audio, text };
    } catch (error) {
      logger.error('Error getting all queue sizes:', error);
      return { video: 0, audio: 0, text: 0 };
    }
  }

  // Get user's position in queue
  async getQueuePosition(userId: string, queueType: SessionType): Promise<number> {
    try {
      const queueKey = this.getQueueKey(queueType);
      const rank = await redisClient.zrank(queueKey, userId);
      return rank !== null ? rank + 1 : 0;
    } catch (error) {
      logger.error('Error getting queue position:', error);
      return 0;
    }
  }

  // Check if user is in any queue
  async isUserInQueue(userId: string): Promise<{ inQueue: boolean; queueType?: SessionType }> {
    try {
      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const score = await redisClient.zscore(this.getQueueKey(type), userId);
        if (score !== null) return { inQueue: true, queueType: type };
      }
      return { inQueue: false };
    } catch (error) {
      logger.error('Error checking if user in queue:', error);
      return { inQueue: false };
    }
  }

  // Remove user from all queues
  async removeFromAllQueues(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.removeFromQueue(userId, SessionType.VIDEO),
        this.removeFromQueue(userId, SessionType.AUDIO),
        this.removeFromQueue(userId, SessionType.TEXT),
      ]);
      logger.info(`User ${userId} removed from all queues`);
    } catch (error) {
      logger.error('Error removing user from all queues:', error);
    }
  }

  /**
   * Cleanup stale queue entries AND their orphaned queue:user: data keys.
   */
  async cleanupStaleEntries(): Promise<number> {
    try {
      const now = Date.now();
      const cutoff = now - this.QUEUE_TIMEOUT;
      let totalRemoved = 0;

      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);

        // Get stale members before removing so we can delete their data keys too
        const staleMembers = await redisClient.zrangebyscore(queueKey, 0, cutoff);

        if (staleMembers.length > 0) {
          // Delete orphaned data keys
          const dataKeys = staleMembers.map((uid) => `queue:user:${uid}`);
          await redisClient.del(...dataKeys);

          // Remove from sorted set
          const removed = await redisClient.zremrangebyscore(queueKey, 0, cutoff);
          totalRemoved += removed;

          logger.info(`Removed ${removed} stale entries from ${type} queue`);
          MetricsService.trackQueueLeave(type, 'timeout');
        }

        const queueSize = await this.getQueueSize(type);
        MetricsService.updateQueueSize(type, queueSize);
      }

      return totalRemoved;
    } catch (error) {
      logger.error('Error cleaning up stale entries:', error);
      return 0;
    }
  }

  // Get queue statistics
  async getQueueStats(): Promise<any> {
    try {
      const sizes = await this.getAllQueueSizes();
      const oldestTimes: any = {};

      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);
        const oldest = await redisClient.zrange(queueKey, 0, 0, 'WITHSCORES');
        if (oldest.length > 0) {
          oldestTimes[type] = {
            userId: oldest[0],
            waitTime: Math.floor((Date.now() - parseInt(oldest[1])) / 1000),
          };
        }
      }

      return { sizes, oldestTimes, timestamp: Date.now() };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }

  // Get queue key for session type
  private getQueueKey(queueType: SessionType): string {
    switch (queueType) {
      case SessionType.VIDEO:  return REDIS_KEYS.QUEUE_VIDEO;
      case SessionType.AUDIO:  return REDIS_KEYS.QUEUE_AUDIO;
      case SessionType.TEXT:   return REDIS_KEYS.QUEUE_TEXT;
      default:                 return REDIS_KEYS.QUEUE_VIDEO;
    }
  }

  // Clear all queues (for maintenance)
  async clearAllQueues(): Promise<void> {
    try {
      await Promise.all([
        redisClient.del(REDIS_KEYS.QUEUE_VIDEO),
        redisClient.del(REDIS_KEYS.QUEUE_AUDIO),
        redisClient.del(REDIS_KEYS.QUEUE_TEXT),
      ]);
      logger.info('All queues cleared');
    } catch (error) {
      logger.error('Error clearing queues:', error);
    }
  }
}

export default new QueueManager();
