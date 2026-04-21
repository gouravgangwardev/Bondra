// src/services/matching/queueManager.ts
// Atomic matchmaking using Lua scripts — eliminates TOCTOU race conditions.

import { redisClient, REDIS_KEYS } from '../../config/redis';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IQueueUser {
  userId:   string;
  socketId: string;
  joinedAt: number;
}

// Lua script: atomically pop the two oldest entries from a sorted set.
// Returns [userId1, score1, userId2, score2] or empty array if < 2 members.
const ZPOPMIN2_SCRIPT = `
local key = KEYS[1]
local count = redis.call('ZCARD', key)
if count < 2 then
  return {}
end
local pair = redis.call('ZPOPMIN', key, 2)
return pair
`;

export class QueueManager {
  private readonly QUEUE_TIMEOUT = 60000; // 60 s

  // ── Add to queue ────────────────────────────────────────────────────────────

  async addToQueue(
    userId:    string,
    socketId:  string,
    queueType: SessionType
  ): Promise<boolean> {
    try {
      const queueKey = this.getQueueKey(queueType);
      const timestamp = Date.now();

      // Idempotency: refuse if already in this queue
      const existingScore = await redisClient.zscore(queueKey, userId);
      if (existingScore !== null) {
        logger.warn(`User ${userId} already in ${queueType} queue — skipping`);
        return false;
      }

      // Also refuse if user is already in ANY other queue
      for (const t of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        if (t === queueType) continue;
        const s = await redisClient.zscore(this.getQueueKey(t), userId);
        if (s !== null) {
          logger.warn(`User ${userId} already in ${t} queue — cannot join ${queueType}`);
          return false;
        }
      }

      const userData: IQueueUser = { userId, socketId, joinedAt: timestamp };

      // Pipeline: store user data + add to sorted set atomically
      const pipeline = redisClient.pipeline();
      pipeline.set(`queue:user:${userId}`, JSON.stringify(userData), 'EX', 120);
      pipeline.zadd(queueKey, timestamp, userId);
      await pipeline.exec();

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

  // ── Remove from queue ───────────────────────────────────────────────────────

  async removeFromQueue(userId: string, queueType: SessionType): Promise<boolean> {
    try {
      const queueKey = this.getQueueKey(queueType);

      const userData = await this.getUserData(userId);
      if (userData) {
        const waitTime = (Date.now() - userData.joinedAt) / 1000;
        MetricsService.trackQueueWaitTime(queueType, waitTime);
      }

      const pipeline = redisClient.pipeline();
      pipeline.zrem(queueKey, userId);
      pipeline.del(`queue:user:${userId}`);
      const results = await pipeline.exec();

      const removed = (results?.[0]?.[1] as number) ?? 0;

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

  // ── Atomic pair pop ─────────────────────────────────────────────────────────
  // Returns [user1Data, user2Data] or null if < 2 users available.
  // Uses a Lua script so the pop is atomic — no lock needed, no TOCTOU.

  async popPair(queueType: SessionType): Promise<[IQueueUser, IQueueUser] | null> {
    try {
      const queueKey = this.getQueueKey(queueType);

      const result = (await redisClient.eval(
        ZPOPMIN2_SCRIPT,
        1,
        queueKey
      )) as string[];

      if (!result || result.length < 4) {
        return null;
      }

      // result = [userId1, score1, userId2, score2]
      const id1 = result[0];
      const id2 = result[2];

      const [data1, data2] = await Promise.all([
        this.getUserData(id1),
        this.getUserData(id2),
      ]);

      // Clean up user data keys
      await Promise.all([
        redisClient.del(`queue:user:${id1}`),
        redisClient.del(`queue:user:${id2}`),
      ]);

      if (!data1 || !data2) {
        // If either user's metadata is missing, re-push what we have
        if (data1) await redisClient.zadd(queueKey, data1.joinedAt, id1);
        if (data2) await redisClient.zadd(queueKey, data2.joinedAt, id2);
        logger.warn(`Queue pair pop: missing user data for ${!data1 ? id1 : id2}`);
        return null;
      }

      const queueSize = await this.getQueueSize(queueType);
      MetricsService.updateQueueSize(queueType, queueSize);
      MetricsService.trackQueueLeave(queueType, 'matched');

      logger.info(`Atomic pair popped: ${id1} <-> ${id2} (${queueType})`);
      return [data1, data2];
    } catch (error) {
      logger.error('Error in atomic popPair:', error);
      return null;
    }
  }

  // ── Legacy findMatch (kept for matchHandler direct-path compatibility) ───────
  // Delegates to popPair internally. Returns the partner of userId.

  async findMatch(userId: string, queueType: SessionType): Promise<IQueueUser | null> {
    const pair = await this.popPair(queueType);
    if (!pair) return null;

    const [u1, u2] = pair;

    // If the caller is not in the pair, re-push both and return null
    if (u1.userId !== userId && u2.userId !== userId) {
      const queueKey = this.getQueueKey(queueType);
      await Promise.all([
        redisClient.zadd(queueKey, u1.joinedAt, u1.userId),
        redisClient.zadd(queueKey, u2.joinedAt, u2.userId),
      ]);
      return null;
    }

    return u1.userId === userId ? u2 : u1;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getUserData(userId: string): Promise<IQueueUser | null> {
    try {
      const data = await redisClient.get(`queue:user:${userId}`);
      if (!data) return null;
      return JSON.parse(data) as IQueueUser;
    } catch (error) {
      logger.error('Error getting user data:', error);
      return null;
    }
  }

  async getQueueSize(queueType: SessionType): Promise<number> {
    try {
      return await redisClient.zcard(this.getQueueKey(queueType));
    } catch (error) {
      logger.error('Error getting queue size:', error);
      return 0;
    }
  }

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

  async getQueuePosition(userId: string, queueType: SessionType): Promise<number> {
    try {
      const rank = await redisClient.zrank(this.getQueueKey(queueType), userId);
      return rank !== null ? rank + 1 : 0;
    } catch (error) {
      logger.error('Error getting queue position:', error);
      return 0;
    }
  }

  async isUserInQueue(userId: string): Promise<{ inQueue: boolean; queueType?: SessionType }> {
    try {
      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const score = await redisClient.zscore(this.getQueueKey(type), userId);
        if (score !== null) return { inQueue: true, queueType: type };
      }
      return { inQueue: false };
    } catch (error) {
      logger.error('Error checking user in queue:', error);
      return { inQueue: false };
    }
  }

  async removeFromAllQueues(userId: string): Promise<void> {
    try {
      await Promise.all(
        [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT].map(t =>
          this.removeFromQueue(userId, t)
        )
      );
      logger.info(`User ${userId} removed from all queues`);
    } catch (error) {
      logger.error('Error removing user from all queues:', error);
    }
  }

  async cleanupStaleEntries(): Promise<number> {
    try {
      const cutoff = Date.now() - this.QUEUE_TIMEOUT;
      let totalRemoved = 0;

      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);
        const stale = await redisClient.zrangebyscore(queueKey, 0, cutoff);

        for (const userId of stale) {
          await redisClient.zrem(queueKey, userId);
          await redisClient.del(`queue:user:${userId}`);
          totalRemoved++;
        }

        if (stale.length > 0) {
          logger.info(`Removed ${stale.length} stale entries from ${type} queue`);
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

  async getQueueStats(): Promise<unknown> {
    try {
      const sizes = await this.getAllQueueSizes();
      const oldestTimes: Record<string, unknown> = {};

      for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
        const queueKey = this.getQueueKey(type);
        const oldest = await redisClient.zrange(queueKey, 0, 0, 'WITHSCORES');
        if (oldest.length > 0) {
          oldestTimes[type] = {
            userId:   oldest[0],
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

  async getOldestInQueue(queueType: SessionType): Promise<IQueueUser | null> {
    try {
      const users = await redisClient.zrange(this.getQueueKey(queueType), 0, 0);
      if (!users.length) return null;
      return this.getUserData(users[0]);
    } catch (error) {
      logger.error('Error getting oldest in queue:', error);
      return null;
    }
  }

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

  // ── Private ─────────────────────────────────────────────────────────────────

  private getQueueKey(queueType: SessionType): string {
    switch (queueType) {
      case SessionType.VIDEO: return REDIS_KEYS.QUEUE_VIDEO;
      case SessionType.AUDIO: return REDIS_KEYS.QUEUE_AUDIO;
      case SessionType.TEXT:  return REDIS_KEYS.QUEUE_TEXT;
      default:                return REDIS_KEYS.QUEUE_VIDEO;
    }
  }
}

export default new QueueManager();
