// src/services/cache/cacheKeys.ts

/**
 * Centralized cache key management for consistent naming
 * and easy invalidation patterns
 */

export const CACHE_KEYS = {
  // User cache keys
  USER: {
    PROFILE: (userId: string) => `user:profile:${userId}`,
    SETTINGS: (userId: string) => `user:settings:${userId}`,
    STATS: (userId: string) => `user:stats:${userId}`,
    SESSIONS: (userId: string) => `user:sessions:${userId}`,
    PATTERN: 'user:*',
  },

  // Friend cache keys
  FRIEND: {
    LIST: (userId: string) => `friend:list:${userId}`,
    ONLINE: (userId: string) => `friend:online:${userId}`,
    REQUESTS_PENDING: (userId: string) => `friend:requests:pending:${userId}`,
    REQUESTS_SENT: (userId: string) => `friend:requests:sent:${userId}`,
    BLOCKED: (userId: string) => `friend:blocked:${userId}`,
    STATUS: (userId: string, friendId: string) => `friend:status:${userId}:${friendId}`,
    MUTUAL: (userId: string, friendId: string) => `friend:mutual:${userId}:${friendId}`,
    PATTERN: 'friend:*',
  },

  // Session cache keys
  SESSION: {
    ACTIVE: (sessionId: string) => `session:active:${sessionId}`,
    USER: (userId: string) => `session:user:${userId}`,
    STATS: 'session:stats',
    HISTORY: (userId: string, page: number) => `session:history:${userId}:${page}`,
    PATTERN: 'session:*',
  },

  // Queue cache keys
  QUEUE: {
    SIZE: (type: string) => `queue:size:${type}`,
    POSITION: (userId: string, type: string) => `queue:position:${userId}:${type}`,
    STATS: 'queue:stats',
    PATTERN: 'queue:*',
  },

  // Report cache keys
  REPORT: {
    COUNT: (userId: string) => `report:count:${userId}`,
    RECENT: (limit: number) => `report:recent:${limit}`,
    STATS: 'report:stats',
    PENDING: 'report:pending:count',
    PATTERN: 'report:*',
  },

  // Presence cache keys
  PRESENCE: {
    STATUS: (userId: string) => `presence:status:${userId}`,
    ONLINE_COUNT: 'presence:online:count',
    STATS: 'presence:stats',
    PATTERN: 'presence:*',
  },

  // Authentication cache keys
  AUTH: {
    LOGIN_ATTEMPTS: (identifier: string) => `auth:attempts:${identifier}`,
    LOCKOUT: (identifier: string) => `auth:lockout:${identifier}`,
    PASSWORD_RESET: (token: string) => `auth:reset:${token}`,
    PATTERN: 'auth:*',
  },

  // Rate limiting cache keys
  RATE_LIMIT: {
    API: (ip: string, endpoint: string) => `ratelimit:api:${ip}:${endpoint}`,
    WS: (userId: string, event: string) => `ratelimit:ws:${userId}:${event}`,
    REPORT: (userId: string) => `ratelimit:report:${userId}`,
    FRIEND_REQUEST: (userId: string) => `ratelimit:friend:${userId}`,
    PATTERN: 'ratelimit:*',
  },

  // Analytics cache keys
  ANALYTICS: {
    DAILY_STATS: (date: string) => `analytics:daily:${date}`,
    HOURLY_STATS: (hour: string) => `analytics:hourly:${hour}`,
    USER_ACTIVITY: (userId: string) => `analytics:activity:${userId}`,
    PATTERN: 'analytics:*',
  },

  // Configuration cache keys
  CONFIG: {
    FEATURE_FLAGS: 'config:features',
    MAINTENANCE_MODE: 'config:maintenance',
    ANNOUNCEMENT: 'config:announcement',
    PATTERN: 'config:*',
  },

  // Search cache keys
  SEARCH: {
    USERS: (query: string, page: number) => `search:users:${query}:${page}`,
    PATTERN: 'search:*',
  },

  // Notification cache keys (future feature)
  NOTIFICATION: {
    UNREAD_COUNT: (userId: string) => `notification:unread:${userId}`,
    LIST: (userId: string, page: number) => `notification:list:${userId}:${page}`,
    PATTERN: 'notification:*',
  },

  // Leaderboard cache keys (future feature)
  LEADERBOARD: {
    DAILY: 'leaderboard:daily',
    WEEKLY: 'leaderboard:weekly',
    MONTHLY: 'leaderboard:monthly',
    ALL_TIME: 'leaderboard:alltime',
    PATTERN: 'leaderboard:*',
  },
};

/**
 * Cache TTL (Time To Live) values in seconds
 */
export const CACHE_TTL_VALUES = {
  // Short-lived cache (30 seconds - 1 minute)
  VERY_SHORT: 30,
  SHORT: 60,

  // Medium cache (5 - 15 minutes)
  MEDIUM: 300,
  MEDIUM_LONG: 900,

  // Long cache (30 minutes - 1 hour)
  LONG: 1800,
  VERY_LONG: 3600,

  // Extended cache (6 hours - 1 day)
  EXTENDED: 21600,
  DAY: 86400,

  // Specific use cases
  USER_PROFILE: 300,          // 5 minutes
  FRIEND_LIST: 60,            // 1 minute
  ONLINE_STATUS: 30,          // 30 seconds
  QUEUE_STATS: 10,            // 10 seconds
  SESSION_DATA: 3600,         // 1 hour
  REPORT_STATS: 300,          // 5 minutes
  LOGIN_ATTEMPTS: 900,        // 15 minutes
  RATE_LIMIT: 60,             // 1 minute
  SEARCH_RESULTS: 300,        // 5 minutes
  ANALYTICS: 3600,            // 1 hour
  FEATURE_FLAGS: 600,         // 10 minutes
};

/**
 * Helper functions for cache key management
 */
export class CacheKeyHelper {
  /**
   * Get all user-related cache keys for a user
   */
  static getUserCacheKeys(userId: string): string[] {
    return [
      CACHE_KEYS.USER.PROFILE(userId),
      CACHE_KEYS.USER.SETTINGS(userId),
      CACHE_KEYS.USER.STATS(userId),
      CACHE_KEYS.USER.SESSIONS(userId),
      CACHE_KEYS.FRIEND.LIST(userId),
      CACHE_KEYS.FRIEND.ONLINE(userId),
      CACHE_KEYS.FRIEND.REQUESTS_PENDING(userId),
      CACHE_KEYS.FRIEND.REQUESTS_SENT(userId),
      CACHE_KEYS.SESSION.USER(userId),
      CACHE_KEYS.PRESENCE.STATUS(userId),
    ];
  }

  /**
   * Get all friend-related cache keys for a user
   */
  static getFriendCacheKeys(userId: string): string[] {
    return [
      CACHE_KEYS.FRIEND.LIST(userId),
      CACHE_KEYS.FRIEND.ONLINE(userId),
      CACHE_KEYS.FRIEND.REQUESTS_PENDING(userId),
      CACHE_KEYS.FRIEND.REQUESTS_SENT(userId),
      CACHE_KEYS.FRIEND.BLOCKED(userId),
    ];
  }

  /**
   * Get cache key pattern for friendship between two users
   */
  static getFriendshipPattern(userId: string, friendId: string): string[] {
    return [
      CACHE_KEYS.FRIEND.STATUS(userId, friendId),
      CACHE_KEYS.FRIEND.STATUS(friendId, userId),
      CACHE_KEYS.FRIEND.MUTUAL(userId, friendId),
      CACHE_KEYS.FRIEND.MUTUAL(friendId, userId),
    ];
  }

  /**
   * Get all session-related cache keys for a user
   */
  static getSessionCacheKeys(userId: string): string[] {
    return [
      CACHE_KEYS.SESSION.USER(userId),
      CACHE_KEYS.USER.SESSIONS(userId),
    ];
  }

  /**
   * Build paginated cache key
   */
  static buildPaginatedKey(baseKey: string, page: number, limit: number): string {
    return `${baseKey}:page:${page}:limit:${limit}`;
  }

  /**
   * Build filtered cache key
   */
  static buildFilteredKey(baseKey: string, filters: Record<string, any>): string {
    const filterString = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    
    return `${baseKey}:filter:${filterString}`;
  }

  /**
   * Build time-based cache key (for time-series data)
   */
  static buildTimeBasedKey(baseKey: string, timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hour = String(timestamp.getHours()).padStart(2, '0');
    
    return `${baseKey}:${year}:${month}:${day}:${hour}`;
  }

  /**
   * Parse cache key to extract components
   */
  static parseKey(key: string): { prefix: string; parts: string[] } {
    const parts = key.split(':');
    const prefix = parts[0];
    
    return {
      prefix,
      parts: parts.slice(1),
    };
  }

  /**
   * Validate cache key format
   */
  static isValidKey(key: string): boolean {
    // Check if key follows pattern: prefix:identifier:...
    const parts = key.split(':');
    return parts.length >= 2 && parts.every(part => part.length > 0);
  }

  /**
   * Get cache key prefix for bulk operations
   */
  static getPatternForPrefix(prefix: string): string {
    return `${prefix}:*`;
  }

  /**
   * Generate cache key for range queries
   */
  static buildRangeKey(
    baseKey: string,
    start: number,
    end: number
  ): string {
    return `${baseKey}:range:${start}:${end}`;
  }
}

/**
 * Cache invalidation strategies
 */
export class CacheInvalidation {
  /**
   * Get keys to invalidate when user profile changes
   */
  static onUserProfileUpdate(userId: string): string[] {
    return [
      CACHE_KEYS.USER.PROFILE(userId),
      CACHE_KEYS.USER.STATS(userId),
      CACHE_KEYS.SEARCH.PATTERN,
    ];
  }

  /**
   * Get keys to invalidate when friendship changes
   */
  static onFriendshipChange(userId: string, friendId: string): string[] {
    return [
      ...CacheKeyHelper.getFriendCacheKeys(userId),
      ...CacheKeyHelper.getFriendCacheKeys(friendId),
      ...CacheKeyHelper.getFriendshipPattern(userId, friendId),
    ];
  }

  /**
   * Get keys to invalidate when session ends
   */
  static onSessionEnd(userId: string, sessionId: string): string[] {
    return [
      CACHE_KEYS.SESSION.ACTIVE(sessionId),
      CACHE_KEYS.SESSION.USER(userId),
      CACHE_KEYS.USER.SESSIONS(userId),
      CACHE_KEYS.SESSION.STATS,
    ];
  }

  /**
   * Get keys to invalidate when report is submitted
   */
  static onReportSubmit(reportedUserId: string): string[] {
    return [
      CACHE_KEYS.REPORT.COUNT(reportedUserId),
      CACHE_KEYS.REPORT.STATS,
      CACHE_KEYS.REPORT.PENDING,
    ];
  }

  /**
   * Get keys to invalidate on user logout
   */
  static onUserLogout(userId: string): string[] {
    return [
      CACHE_KEYS.PRESENCE.STATUS(userId),
      CACHE_KEYS.SESSION.USER(userId),
      CACHE_KEYS.QUEUE.PATTERN,
    ];
  }
}

export default {
  CACHE_KEYS,
  CACHE_TTL_VALUES,
  CacheKeyHelper,
  CacheInvalidation,
};
