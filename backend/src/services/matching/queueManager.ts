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
  private readonly LOCK_TTL = 5000; // 5 seconds
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
      const userData: IQueueUser = {
        userId,
        socketId,
        joinedAt: timestamp,
      };

      await redisClient.set(
        `${REDIS_KEYS.QUEUE_VIDEO}:user:${userId}`,
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

      // Remove from sorted set
      const removed = await redisClient.zrem(queueKey, userId);

      // Remove user data
      await redisClient.del(`${REDIS_KEYS.QUEUE_VIDEO}:user:${userId}`);

      // Update metrics
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

  // Find a match for user (atomic operation with lock)
  async findMatch(
    userId: string,
    queueType: SessionType
  ): Promise<IQueueUser | null> {
    const lockKey = `${REDIS_KEYS.LOCK_MATCHING}${queueType}`;
    const queueKey = this.getQueueKey(queueType);

    try {
      // Acquire distributed lock
      const lock = await RedisService.acquireLock(lockKey, this.LOCK_TTL);
      if (!lock) {
        logger.debug('Could not acquire lock for matching');
        return null;
      }

      // Get oldest 2 users from queue (atomically)
      const users = await redisClient.zrange(queueKey, 0, 1);

      if (users.length < 2) {
        await RedisService.releaseLock(lockKey);
        return null;
      }

      // Check if current user is in the top 2
      if (!users.includes(userId)) {
        await RedisService.releaseLock(lockKey);
        return null;
      }

      // Get the other user
      const partnerId = users[0] === userId ? users[1] : users[0];

      // Remove both users from queue atomically
      await redisClient.zrem(queueKey, users[0], users[1]);

      // Get partner data
      const partnerData = await this.getUserData(partnerId);

      // Release lock
      await RedisService.releaseLock(lockKey);

      if (!partnerData) {
        // Re-add current user to queue if partner data not found
        await this.addToQueue(userId, '', queueType);
        logger.warn(`Partner data not found for ${partnerId}`);
        return null;
      }

      // Update metrics
      const queueSize = await this.getQueueSize(queueType);
      MetricsService.updateQueueSize(queueType, queueSize);
      MetricsService.trackQueueLeave(queueType, 'matched');

      logger.info(`Match found: ${userId} <-> ${partnerId} (${queueType})`);

      return partnerData;
    } catch (error) {
      logger.error('Error finding match:', error);
      await RedisService.releaseLock(lockKey);
      return null;
    }
  }

  // Get user data from Redis
  async getUserData(userId: string): Promise<IQueueUser | null> {
    try {
      const data = await redisClient.get(`${REDIS_KEYS.QUEUE_VIDEO}:user:${userId}`);
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
  async getAllQueueSizes(): Promise<{
    video: number;
    audio: number;
    text: number;
  }> {
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
  async isUserInQueue(userId: string): Promise<{
    inQueue: boolean;
    queueType?: SessionType;
  }> {
    try {
      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);
        const score = await redisClient.zscore(queueKey, userId);
        
        if (score !== null) {
          return { inQueue: true, queueType: type };
        }
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

  // Cleanup stale queue entries (users who joined but disconnected)
  async cleanupStaleEntries(): Promise<number> {
    try {
      const now = Date.now();
      const cutoff = now - this.QUEUE_TIMEOUT;
      let totalRemoved = 0;

      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);

        // Remove entries older than timeout
        const removed = await redisClient.zremrangebyscore(queueKey, 0, cutoff);
        totalRemoved += removed;

        if (removed > 0) {
          logger.info(`Removed ${removed} stale entries from ${type} queue`);
          MetricsService.trackQueueLeave(type, 'timeout');
        }

        // Update metrics
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
      
      // Get oldest entry time for each queue
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

      return {
        sizes,
        oldestTimes,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }

  // Get queue key for session type
  private getQueueKey(queueType: SessionType): string {
    switch (queueType) {
      case SessionType.VIDEO:
        return REDIS_KEYS.QUEUE_VIDEO;
      case SessionType.AUDIO:
        return REDIS_KEYS.QUEUE_AUDIO;
      case SessionType.TEXT:
        return REDIS_KEYS.QUEUE_TEXT;
      default:
        return REDIS_KEYS.QUEUE_VIDEO;
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