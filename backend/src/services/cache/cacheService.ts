// src/services/cache/cacheService.ts
import { redisCacheClient } from '../../config/redis';
import { logger } from '../../utils/logger';
import { CACHE_TTL } from '../../config/constants';

export interface ICacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface ICacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheService {
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  // Set cache with optional TTL
  async set<T>(
    key: string,
    value: T,
    options?: ICacheOptions
  ): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || CACHE_TTL.USER_PROFILE;
      const serialized = JSON.stringify(value);

      await redisCacheClient.setex(cacheKey, ttl, serialized);
      
      this.stats.sets++;
      logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
      
      return true;
    } catch (error) {
      logger.error('Error setting cache:', error);
      return false;
    }
  }

  // Get cache
  async get<T>(key: string, options?: ICacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const cached = await redisCacheClient.get(cacheKey);

      if (!cached) {
        this.stats.misses++;
        logger.debug(`Cache miss: ${cacheKey}`);
        return null;
      }

      this.stats.hits++;
      logger.debug(`Cache hit: ${cacheKey}`);
      
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('Error getting cache:', error);
      this.stats.misses++;
      return null;
    }
  }

  // Delete cache
  async delete(key: string, options?: ICacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const deleted = await redisCacheClient.del(cacheKey);
      
      this.stats.deletes++;
      
      if (deleted > 0) {
        logger.debug(`Cache deleted: ${cacheKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deleting cache:', error);
      return false;
    }
  }

  // Delete multiple keys matching pattern
  async deletePattern(pattern: string, options?: ICacheOptions): Promise<number> {
    try {
      const searchPattern = this.buildKey(pattern, options?.prefix);
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await redisCacheClient.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          const deleted = await redisCacheClient.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      this.stats.deletes += deletedCount;
      
      if (deletedCount > 0) {
        logger.debug(`Cache pattern deleted: ${searchPattern} (${deletedCount} keys)`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error deleting cache pattern:', error);
      return 0;
    }
  }

  // Check if key exists
  async exists(key: string, options?: ICacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const exists = await redisCacheClient.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking cache existence:', error);
      return false;
    }
  }

  // Get or set (if not exists, fetch and cache)
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: ICacheOptions
  ): Promise<T | null> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key, options);
      
      if (cached !== null) {
        return cached;
      }

      // Fetch data
      const data = await fetcher();
      
      if (data) {
        // Cache the data
        await this.set(key, data, options);
      }

      return data;
    } catch (error) {
      logger.error('Error in getOrSet:', error);
      return null;
    }
  }

  // Set with expiry at specific time
  async setWithExpireAt(
    key: string,
    value: any,
    expiryTimestamp: number,
    options?: ICacheOptions
  ): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const serialized = JSON.stringify(value);

      await redisCacheClient.set(cacheKey, serialized);
      await redisCacheClient.expireat(cacheKey, Math.floor(expiryTimestamp / 1000));

      this.stats.sets++;
      logger.debug(`Cache set with expireAt: ${cacheKey}`);
      
      return true;
    } catch (error) {
      logger.error('Error setting cache with expireAt:', error);
      return false;
    }
  }

  // Increment counter
  async increment(key: string, options?: ICacheOptions): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await redisCacheClient.incr(cacheKey);
      
      logger.debug(`Cache incremented: ${cacheKey} = ${value}`);
      return value;
    } catch (error) {
      logger.error('Error incrementing cache:', error);
      return 0;
    }
  }

  // Decrement counter
  async decrement(key: string, options?: ICacheOptions): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await redisCacheClient.decr(cacheKey);
      
      logger.debug(`Cache decremented: ${cacheKey} = ${value}`);
      return value;
    } catch (error) {
      logger.error('Error decrementing cache:', error);
      return 0;
    }
  }

  // Get TTL for key
  async getTTL(key: string, options?: ICacheOptions): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const ttl = await redisCacheClient.ttl(cacheKey);
      return ttl;
    } catch (error) {
      logger.error('Error getting TTL:', error);
      return -1;
    }
  }

  // Extend TTL for key
  async extendTTL(
    key: string,
    additionalSeconds: number,
    options?: ICacheOptions
  ): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const currentTTL = await redisCacheClient.ttl(cacheKey);
      
      if (currentTTL > 0) {
        const newTTL = currentTTL + additionalSeconds;
        await redisCacheClient.expire(cacheKey, newTTL);
        
        logger.debug(`Cache TTL extended: ${cacheKey} (+${additionalSeconds}s)`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error extending TTL:', error);
      return false;
    }
  }

  // Get multiple keys at once
  async mget<T>(keys: string[], options?: ICacheOptions): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const values = await redisCacheClient.mget(...cacheKeys);

      return values.map((value, index) => {
        if (value) {
          this.stats.hits++;
          logger.debug(`Cache hit: ${cacheKeys[index]}`);
          return JSON.parse(value) as T;
        } else {
          this.stats.misses++;
          logger.debug(`Cache miss: ${cacheKeys[index]}`);
          return null;
        }
      });
    } catch (error) {
      logger.error('Error getting multiple cache keys:', error);
      return keys.map(() => null);
    }
  }

  // Set multiple keys at once
  async mset<T>(
    keyValuePairs: Array<{ key: string; value: T; ttl?: number }>,
    options?: ICacheOptions
  ): Promise<boolean> {
    try {
      const pipeline = redisCacheClient.pipeline();

      for (const pair of keyValuePairs) {
        const cacheKey = this.buildKey(pair.key, options?.prefix);
        const serialized = JSON.stringify(pair.value);
        const ttl = pair.ttl || options?.ttl || CACHE_TTL.USER_PROFILE;

        pipeline.setex(cacheKey, ttl, serialized);
        this.stats.sets++;
      }

      await pipeline.exec();
      
      logger.debug(`Cache mset: ${keyValuePairs.length} keys`);
      return true;
    } catch (error) {
      logger.error('Error setting multiple cache keys:', error);
      return false;
    }
  }

  // Clear all cache (use with caution!)
  async clear(prefix?: string): Promise<boolean> {
    try {
      const pattern = prefix ? `${prefix}:*` : '*';
      const deleted = await this.deletePattern(pattern);
      
      logger.info(`Cache cleared: ${deleted} keys deleted`);
      return true;
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return false;
    }
  }

  // Get cache statistics
  getStats(): ICacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    logger.info('Cache statistics reset');
  }

  // Get cache size (approximate)
  async getSize(prefix?: string): Promise<number> {
    try {
      const pattern = prefix ? `${prefix}:*` : '*';
      let cursor = '0';
      let count = 0;

      do {
        const [newCursor, keys] = await redisCacheClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        count += keys.length;
      } while (cursor !== '0');

      return count;
    } catch (error) {
      logger.error('Error getting cache size:', error);
      return 0;
    }
  }

  // Get all keys matching pattern
  async getKeys(pattern: string, options?: ICacheOptions): Promise<string[]> {
    try {
      const searchPattern = this.buildKey(pattern, options?.prefix);
      let cursor = '0';
      const allKeys: string[] = [];

      do {
        const [newCursor, keys] = await redisCacheClient.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        allKeys.push(...keys);
      } while (cursor !== '0');

      return allKeys;
    } catch (error) {
      logger.error('Error getting cache keys:', error);
      return [];
    }
  }

  // Build cache key with prefix
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  // Warm up cache (preload data)
  async warmUp<T>(
    keys: string[],
    fetcher: (key: string) => Promise<T>,
    options?: ICacheOptions
  ): Promise<number> {
    try {
      let warmedUp = 0;

      for (const key of keys) {
        const exists = await this.exists(key, options);
        
        if (!exists) {
          const data = await fetcher(key);
          if (data) {
            await this.set(key, data, options);
            warmedUp++;
          }
        }
      }

      logger.info(`Cache warmed up: ${warmedUp} keys`);
      return warmedUp;
    } catch (error) {
      logger.error('Error warming up cache:', error);
      return 0;
    }
  }

  // Check cache health
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Try to set and get a test value
      const testKey = 'cache:health:check';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, { ttl: 10 });
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
        return { healthy: true };
      }

      return { healthy: false, message: 'Cache verification failed' };
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return { healthy: false, message: 'Cache connection error' };
    }
  }
}

export default new CacheService();