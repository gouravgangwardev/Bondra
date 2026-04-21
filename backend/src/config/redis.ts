// src/config/redis.ts
import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';
import { ENV } from './environment';

const baseConfig: RedisOptions = {
  host:     ENV.REDIS_HOST,
  port:     ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD || undefined,

  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  enableOfflineQueue:   true,

  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
    return delay;
  },

  lazyConnect:    false,
  keepAlive:      30000,
  connectTimeout: 10000,
  enableAutoPipelining: true,
};

export const redisClient        = new Redis({ ...baseConfig, connectionName: 'primary',    db: 0 });
export const redisPubClient     = new Redis({ ...baseConfig, connectionName: 'pubsub-pub', db: 0 });
export const redisSubClient     = new Redis({ ...baseConfig, connectionName: 'pubsub-sub', db: 0 });
export const redisCacheClient   = new Redis({ ...baseConfig, connectionName: 'cache',      db: 1 });
export const redisSessionClient = new Redis({ ...baseConfig, connectionName: 'session',    db: 2 });

redisClient.on('connect',     () => logger.info('Redis primary connecting'));
redisClient.on('ready',       () => logger.info('Redis primary ready'));
redisClient.on('error',  (e) => logger.error('Redis primary error:', e));
redisClient.on('close',       () => logger.warn('Redis primary closed'));
redisClient.on('reconnecting',() => logger.info('Redis primary reconnecting'));

redisPubClient.on('ready', () => logger.info('Redis pub client ready'));
redisSubClient.on('ready', () => logger.info('Redis sub client ready'));

export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redisClient.ping();
    logger.info('Redis connection successful');
    return true;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    return false;
  }
};

export const REDIS_CHANNELS = {
  USER_ONLINE:     'user:online',
  USER_OFFLINE:    'user:offline',
  MATCH_FOUND:     'match:found',
  SESSION_END:     'session:end',
  FRIEND_REQUEST:  'friend:request',
  FRIEND_ACCEPT:   'friend:accept',
  BROADCAST:       'broadcast',
} as const;

export const REDIS_KEYS = {
  QUEUE_VIDEO:    'queue:video',
  QUEUE_AUDIO:    'queue:audio',
  QUEUE_TEXT:     'queue:text',

  LOCK_MATCHING:  'lock:matching:',
  LOCK_SESSION:   'lock:session:',

  SESSION:        'session:',
  SESSION_USER:   'session:user:',

  USER_ONLINE:    'user:online:',
  USER_STATUS:    'user:status:',

  FRIEND_REQUESTS: 'friend:requests:',
  FRIEND_LIST:     'friend:list:',

  RATE_LIMIT:     'rate:',
  CACHE_USER:     'cache:user:',
  SOCKET_USER:    'socket:user:',
} as const;

export class RedisService {
  static async acquireLock(key: string, ttl = 5000): Promise<boolean> {
    try {
      const result = await redisClient.set(key, '1', 'PX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Error acquiring lock:', error);
      return false;
    }
  }

  static async releaseLock(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Error releasing lock:', error);
    }
  }

  static async withLock<T>(
    lockKey:  string,
    callback: () => Promise<T>,
    ttl = 5000
  ): Promise<T | null> {
    const acquired = await this.acquireLock(lockKey, ttl);
    if (!acquired) {
      logger.warn(`Failed to acquire lock: ${lockKey}`);
      return null;
    }
    try {
      return await callback();
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  static async setCache(key: string, value: unknown, ttl = 300): Promise<void> {
    try {
      await redisCacheClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Error setting cache:', error);
    }
  }

  static async getCache<T>(key: string): Promise<T | null> {
    try {
      const value = await redisCacheClient.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      logger.error('Error getting cache:', error);
      return null;
    }
  }

  static async deleteCache(key: string): Promise<void> {
    try {
      await redisCacheClient.del(key);
    } catch (error) {
      logger.error('Error deleting cache:', error);
    }
  }

  static async publish(channel: string, message: unknown): Promise<void> {
    try {
      await redisPubClient.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error('Error publishing message:', error);
    }
  }

  static subscribe(channel: string, callback: (message: unknown) => void): void {
    redisSubClient.subscribe(channel, (err) => {
      if (err) {
        logger.error(`Error subscribing to ${channel}:`, err);
        return;
      }
      logger.info(`Subscribed to channel: ${channel}`);
    });

    redisSubClient.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          logger.error('Error parsing pub/sub message:', error);
        }
      }
    });
  }

  static async getStats() {
    try {
      const info   = await redisClient.info();
      const dbSize = await redisClient.dbsize();
      return {
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, val] = line.split(':');
          if (key && val) acc[key] = val;
          return acc;
        }, {} as Record<string, string>),
      };
    } catch (error) {
      logger.error('Error getting Redis stats:', error);
      return null;
    }
  }
}

export const closeRedis = async (): Promise<void> => {
  try {
    await Promise.all([
      redisClient.quit(),
      redisPubClient.quit(),
      redisSubClient.quit(),
      redisCacheClient.quit(),
      redisSessionClient.quit(),
    ]);
    logger.info('All Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
    throw error;
  }
};

export const getSocketIORedisAdapter = () => ({
  pubClient: redisPubClient,
  subClient: redisSubClient,
});

export default {
  redisClient,
  redisPubClient,
  redisSubClient,
  redisCacheClient,
  redisSessionClient,
  RedisService,
  REDIS_KEYS,
  REDIS_CHANNELS,
  testRedisConnection,
  closeRedis,
  getSocketIORedisAdapter,
};
