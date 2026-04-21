// src/services/friends/presenceTracker.ts
import { redisClient, RedisService, REDIS_KEYS, REDIS_CHANNELS } from '../../config/redis';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { UserStatus } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IUserPresence {
  userId: string;
  status: UserStatus;
  socketId?: string;
  lastSeen: number;
}

export class PresenceTracker {
  private readonly PRESENCE_TTL = 300; // 5 minutes in seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // 1 minute

  // Set user online
  async setUserOnline(
    userId: string,
    socketId: string,
    status: UserStatus = UserStatus.ONLINE
  ): Promise<boolean> {
    try {
      const presence: IUserPresence = {
        userId,
        status,
        socketId,
        lastSeen: Date.now(),
      };

      // Store presence data
      await redisClient.setex(
        `${REDIS_KEYS.USER_ONLINE}${userId}`,
        this.PRESENCE_TTL,
        JSON.stringify(presence)
      );

      // Store socket to user mapping
      await redisClient.setex(
        `${REDIS_KEYS.SOCKET_USER}${socketId}`,
        this.PRESENCE_TTL,
        userId
      );

      // Update database last seen
      await User.updateLastSeen(userId);

      // Publish online event
      await RedisService.publish(REDIS_CHANNELS.USER_ONLINE, {
        userId,
        status,
        timestamp: Date.now(),
      });

      // Update metrics
      const onlineCount = await this.getOnlineUsersCount();
      MetricsService.updateOnlineUsers(onlineCount);

      logger.debug(`User ${userId} is now ${status}`);

      return true;
    } catch (error) {
      logger.error('Error setting user online:', error);
      return false;
    }
  }

  // Set user offline
  async setUserOffline(userId: string): Promise<boolean> {
    try {
      // Get presence data to get socketId
      const presence = await this.getUserPresence(userId);

      // Remove presence data
      await redisClient.del(`${REDIS_KEYS.USER_ONLINE}${userId}`);

      if (presence?.socketId) {
        await redisClient.del(`${REDIS_KEYS.SOCKET_USER}${presence.socketId}`);
      }

      // Update database last seen
      await User.updateLastSeen(userId);

      // Publish offline event
      await RedisService.publish(REDIS_CHANNELS.USER_OFFLINE, {
        userId,
        timestamp: Date.now(),
      });

      // Update metrics
      const onlineCount = await this.getOnlineUsersCount();
      MetricsService.updateOnlineUsers(onlineCount);

      logger.debug(`User ${userId} is now offline`);

      return true;
    } catch (error) {
      logger.error('Error setting user offline:', error);
      return false;
    }
  }

  // Update user status
  async updateUserStatus(userId: string, status: UserStatus): Promise<boolean> {
    try {
      const presence = await this.getUserPresence(userId);

      if (!presence) {
        return false;
      }

      presence.status = status;
      presence.lastSeen = Date.now();

      await redisClient.setex(
        `${REDIS_KEYS.USER_ONLINE}${userId}`,
        this.PRESENCE_TTL,
        JSON.stringify(presence)
      );

      logger.debug(`User ${userId} status updated to ${status}`);

      return true;
    } catch (error) {
      logger.error('Error updating user status:', error);
      return false;
    }
  }

  // Get user presence
  async getUserPresence(userId: string): Promise<IUserPresence | null> {
    try {
      const data = await redisClient.get(`${REDIS_KEYS.USER_ONLINE}${userId}`);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Error getting user presence:', error);
      return null;
    }
  }

  // Check if user is online
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const presence = await this.getUserPresence(userId);
      return presence !== null;
    } catch (error) {
      logger.error('Error checking if user online:', error);
      return false;
    }
  }

  // Get user by socket ID
  async getUserBySocketId(socketId: string): Promise<string | null> {
    try {
      return await redisClient.get(`${REDIS_KEYS.SOCKET_USER}${socketId}`);
    } catch (error) {
      logger.error('Error getting user by socket ID:', error);
      return null;
    }
  }

  // Get user status
  async getUserStatus(userId: string): Promise<UserStatus> {
    try {
      const presence = await this.getUserPresence(userId);
      return presence?.status || UserStatus.OFFLINE;
    } catch (error) {
      logger.error('Error getting user status:', error);
      return UserStatus.OFFLINE;
    }
  }

  // Get online users count
  async getOnlineUsersCount(): Promise<number> {
    try {
      let cursor = '0';
      let count = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          `${REDIS_KEYS.USER_ONLINE}*`,
          'COUNT',
          100
        );
        cursor = newCursor;
        count += keys.length;
      } while (cursor !== '0');

      return count;
    } catch (error) {
      logger.error('Error getting online users count:', error);
      return 0;
    }
  }

  // Get all online users
  async getOnlineUsers(): Promise<IUserPresence[]> {
    try {
      let cursor = '0';
      const users: IUserPresence[] = [];

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          `${REDIS_KEYS.USER_ONLINE}*`,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const data = await redisClient.get(key);
          if (data) {
            users.push(JSON.parse(data));
          }
        }
      } while (cursor !== '0');

      return users;
    } catch (error) {
      logger.error('Error getting online users:', error);
      return [];
    }
  }

  // Get multiple users' presence
  async getMultiplePresence(userIds: string[]): Promise<Map<string, IUserPresence>> {
    try {
      const presenceMap = new Map<string, IUserPresence>();

      const pipeline = redisClient.pipeline();
      userIds.forEach(userId => {
        pipeline.get(`${REDIS_KEYS.USER_ONLINE}${userId}`);
      });

      const results = await pipeline.exec();

      if (results) {
        results.forEach((result, index) => {
          const [error, data] = result;
          if (!error && data) {
            const presence = JSON.parse(data as string);
            presenceMap.set(userIds[index], presence);
          }
        });
      }

      return presenceMap;
    } catch (error) {
      logger.error('Error getting multiple presence:', error);
      return new Map();
    }
  }

  // Refresh user presence (heartbeat)
  async refreshPresence(userId: string): Promise<boolean> {
    try {
      const presence = await this.getUserPresence(userId);

      if (!presence) {
        return false;
      }

      presence.lastSeen = Date.now();

      await redisClient.setex(
        `${REDIS_KEYS.USER_ONLINE}${userId}`,
        this.PRESENCE_TTL,
        JSON.stringify(presence)
      );

      return true;
    } catch (error) {
      logger.error('Error refreshing presence:', error);
      return false;
    }
  }

  // Clean up stale presence data
  async cleanupStalePresence(): Promise<number> {
    try {
      const users = await this.getOnlineUsers();
      const now = Date.now();
      let cleaned = 0;

      for (const user of users) {
        // If last seen is older than TTL + grace period, consider stale
        if (now - user.lastSeen > (this.PRESENCE_TTL * 1000) + 60000) {
          await this.setUserOffline(user.userId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale presence entries`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up stale presence:', error);
      return 0;
    }
  }

  // Subscribe to presence events
  subscribeToPresenceEvents(
    onUserOnline: (data: any) => void,
    onUserOffline: (data: any) => void
  ): void {
    RedisService.subscribe(REDIS_CHANNELS.USER_ONLINE, onUserOnline);
    RedisService.subscribe(REDIS_CHANNELS.USER_OFFLINE, onUserOffline);
    
    logger.info('Subscribed to presence events');
  }

  // Get presence statistics
  async getPresenceStats(): Promise<any> {
    try {
      const users = await this.getOnlineUsers();
      
      const stats = {
        total_online: users.length,
        by_status: {
          online: 0,
          in_call: 0,
          away: 0,
        },
        timestamp: Date.now(),
      };

      users.forEach(user => {
        if (user.status === UserStatus.ONLINE) stats.by_status.online++;
        else if (user.status === UserStatus.IN_CALL) stats.by_status.in_call++;
        else if (user.status === UserStatus.AWAY) stats.by_status.away++;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting presence stats:', error);
      return null;
    }
  }

  // Broadcast to online friends
  async broadcastToFriends(
    userId: string,
    friendIds: string[],
    event: string,
    data: any
  ): Promise<void> {
    try {
      const presenceMap = await this.getMultiplePresence(friendIds);
      
      const onlineFriends = friendIds.filter(friendId => 
        presenceMap.has(friendId)
      );

      if (onlineFriends.length === 0) {
        return;
      }

      // Publish event for each online friend
      // This would be handled by WebSocket handler
      logger.debug(`Broadcasting to ${onlineFriends.length} online friends`);
    } catch (error) {
      logger.error('Error broadcasting to friends:', error);
    }
  }

  // Get user's socket ID
  async getUserSocketId(userId: string): Promise<string | null> {
    try {
      const presence = await this.getUserPresence(userId);
      return presence?.socketId || null;
    } catch (error) {
      logger.error('Error getting user socket ID:', error);
      return null;
    }
  }

  // Set user as away (after inactivity)
  async setUserAway(userId: string): Promise<boolean> {
    try {
      return await this.updateUserStatus(userId, UserStatus.AWAY);
    } catch (error) {
      logger.error('Error setting user away:', error);
      return false;
    }
  }

  // Set user in call
  async setUserInCall(userId: string): Promise<boolean> {
    try {
      return await this.updateUserStatus(userId, UserStatus.IN_CALL);
    } catch (error) {
      logger.error('Error setting user in call:', error);
      return false;
    }
  }
}

export default new PresenceTracker();