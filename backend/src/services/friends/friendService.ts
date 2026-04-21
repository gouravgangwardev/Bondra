// src/services/friends/friendService.ts
import { Friendship, IFriendWithDetails } from '../../models/Friendship';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { FriendshipStatus } from '../../config/constants';
import { RedisService, REDIS_KEYS } from '../../config/redis';
import { MetricsService } from '../../config/monitoring';

export interface IFriendRequestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class FriendService {
  // Send friend request
  static async sendFriendRequest(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      // Check if trying to friend self
      if (userId === friendId) {
        return {
          success: false,
          error: 'Cannot send friend request to yourself',
        };
      }

      // Check if friend exists
      const friend = await User.findById(friendId);
      if (!friend) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if already friends or request exists
      const existing = await Friendship.findFriendship(userId, friendId);
      if (existing) {
        if (existing.status === FriendshipStatus.ACCEPTED) {
          return {
            success: false,
            error: 'Already friends',
          };
        }
        if (existing.status === FriendshipStatus.PENDING) {
          return {
            success: false,
            error: 'Friend request already sent',
          };
        }
        if (existing.status === FriendshipStatus.BLOCKED) {
          return {
            success: false,
            error: 'Cannot send friend request',
          };
        }
      }

      // Send request
      const friendship = await Friendship.sendRequest(userId, friendId);

      if (!friendship) {
        return {
          success: false,
          error: 'Failed to send friend request',
        };
      }

      // Update metrics
      MetricsService.friendRequestsTotal.labels('sent').inc();

      // Clear cache
      await this.clearFriendCache(userId);
      await this.clearFriendCache(friendId);

      logger.info(`Friend request sent: ${userId} -> ${friendId}`);

      return {
        success: true,
        message: 'Friend request sent',
      };
    } catch (error) {
      logger.error('Error sending friend request:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Accept friend request
  static async acceptFriendRequest(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      const accepted = await Friendship.acceptRequest(userId, friendId);

      if (!accepted) {
        return {
          success: false,
          error: 'No pending friend request found',
        };
      }

      // Update metrics
      MetricsService.friendRequestsTotal.labels('accepted').inc();
      MetricsService.friendsTotal.inc();

      // Clear cache
      await this.clearFriendCache(userId);
      await this.clearFriendCache(friendId);

      logger.info(`Friend request accepted: ${friendId} -> ${userId}`);

      return {
        success: true,
        message: 'Friend request accepted',
      };
    } catch (error) {
      logger.error('Error accepting friend request:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Reject friend request
  static async rejectFriendRequest(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      const rejected = await Friendship.rejectRequest(userId, friendId);

      if (!rejected) {
        return {
          success: false,
          error: 'No pending friend request found',
        };
      }

      // Update metrics
      MetricsService.friendRequestsTotal.labels('rejected').inc();

      // Clear cache
      await this.clearFriendCache(userId);
      await this.clearFriendCache(friendId);

      logger.info(`Friend request rejected: ${friendId} -> ${userId}`);

      return {
        success: true,
        message: 'Friend request rejected',
      };
    } catch (error) {
      logger.error('Error rejecting friend request:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Remove friend
  static async removeFriend(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      const removed = await Friendship.removeFriend(userId, friendId);

      if (!removed) {
        return {
          success: false,
          error: 'Friendship not found',
        };
      }

      // Update metrics
      MetricsService.friendsTotal.dec();

      // Clear cache
      await this.clearFriendCache(userId);
      await this.clearFriendCache(friendId);

      logger.info(`Friendship removed: ${userId} <-> ${friendId}`);

      return {
        success: true,
        message: 'Friend removed',
      };
    } catch (error) {
      logger.error('Error removing friend:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Block user
  static async blockUser(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      const blocked = await Friendship.blockUser(userId, friendId);

      if (!blocked) {
        return {
          success: false,
          error: 'Failed to block user',
        };
      }

      // Clear cache
      await this.clearFriendCache(userId);
      await this.clearFriendCache(friendId);

      logger.info(`User blocked: ${friendId} by ${userId}`);

      return {
        success: true,
        message: 'User blocked',
      };
    } catch (error) {
      logger.error('Error blocking user:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Unblock user
  static async unblockUser(
    userId: string,
    friendId: string
  ): Promise<IFriendRequestResult> {
    try {
      const unblocked = await Friendship.unblockUser(userId, friendId);

      if (!unblocked) {
        return {
          success: false,
          error: 'User is not blocked',
        };
      }

      // Clear cache
      await this.clearFriendCache(userId);

      logger.info(`User unblocked: ${friendId} by ${userId}`);

      return {
        success: true,
        message: 'User unblocked',
      };
    } catch (error) {
      logger.error('Error unblocking user:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Get friend list with caching
  static async getFriendList(userId: string): Promise<IFriendWithDetails[]> {
    try {
      // Try cache first
      const cacheKey = `${REDIS_KEYS.FRIEND_LIST}${userId}`;
      const cached = await RedisService.getCache<IFriendWithDetails[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Get from database
      const friends = await Friendship.getFriends(userId);

      // Cache for 1 minute
      await RedisService.setCache(cacheKey, friends, 60);

      return friends;
    } catch (error) {
      logger.error('Error getting friend list:', error);
      return [];
    }
  }

  // Get pending friend requests
  static async getPendingRequests(userId: string): Promise<IFriendWithDetails[]> {
    try {
      return await Friendship.getPendingRequests(userId);
    } catch (error) {
      logger.error('Error getting pending requests:', error);
      return [];
    }
  }

  // Get sent friend requests
  static async getSentRequests(userId: string): Promise<IFriendWithDetails[]> {
    try {
      return await Friendship.getSentRequests(userId);
    } catch (error) {
      logger.error('Error getting sent requests:', error);
      return [];
    }
  }

  // Get blocked users
  static async getBlockedUsers(userId: string): Promise<IFriendWithDetails[]> {
    try {
      return await Friendship.getBlockedUsers(userId);
    } catch (error) {
      logger.error('Error getting blocked users:', error);
      return [];
    }
  }

  // Check if users are friends
  static async areFriends(userId: string, friendId: string): Promise<boolean> {
    try {
      return await Friendship.areFriends(userId, friendId);
    } catch (error) {
      logger.error('Error checking friendship:', error);
      return false;
    }
  }

  // Check if user is blocked
  static async isBlocked(userId: string, friendId: string): Promise<boolean> {
    try {
      return await Friendship.isBlocked(userId, friendId);
    } catch (error) {
      logger.error('Error checking block status:', error);
      return false;
    }
  }

  // Get friendship status
  static async getFriendshipStatus(
    userId: string,
    friendId: string
  ): Promise<FriendshipStatus | null> {
    try {
      return await Friendship.getStatus(userId, friendId);
    } catch (error) {
      logger.error('Error getting friendship status:', error);
      return null;
    }
  }

  // Get online friends
  static async getOnlineFriends(userId: string): Promise<IFriendWithDetails[]> {
    try {
      return await Friendship.getOnlineFriends(userId);
    } catch (error) {
      logger.error('Error getting online friends:', error);
      return [];
    }
  }

  // Get mutual friends
  static async getMutualFriends(
    userId: string,
    otherUserId: string
  ): Promise<string[]> {
    try {
      return await Friendship.getMutualFriends(userId, otherUserId);
    } catch (error) {
      logger.error('Error getting mutual friends:', error);
      return [];
    }
  }

  // Get friend statistics
  static async getFriendStats(userId: string): Promise<any> {
    try {
      const [friendCount, onlineFriends, pendingRequests, sentRequests] = await Promise.all([
        Friendship.getFriendCount(userId),
        this.getOnlineFriends(userId),
        this.getPendingRequests(userId),
        this.getSentRequests(userId),
      ]);

      return {
        total_friends: friendCount,
        online_friends: onlineFriends.length,
        pending_requests: pendingRequests.length,
        sent_requests: sentRequests.length,
      };
    } catch (error) {
      logger.error('Error getting friend stats:', error);
      return null;
    }
  }

  // Search friends
  static async searchFriends(
    userId: string,
    searchTerm: string
  ): Promise<IFriendWithDetails[]> {
    try {
      const friends = await this.getFriendList(userId);
      
      if (!searchTerm) {
        return friends;
      }

      const lowerSearch = searchTerm.toLowerCase();
      
      return friends.filter(friend =>
        friend.friend_username.toLowerCase().includes(lowerSearch)
      );
    } catch (error) {
      logger.error('Error searching friends:', error);
      return [];
    }
  }

  // Clear friend cache
  private static async clearFriendCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${REDIS_KEYS.FRIEND_LIST}${userId}`;
      await RedisService.deleteCache(cacheKey);
    } catch (error) {
      logger.error('Error clearing friend cache:', error);
    }
  }

  // Suggest friends (users who have mutual friends)
  static async suggestFriends(
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      // Get current friends
      const friends = await this.getFriendList(userId);
      const friendIds = friends.map(f => 
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // Get friends of friends
      const suggestions = new Map<string, number>();

      for (const friendId of friendIds) {
        const friendsOfFriend = await this.getFriendList(friendId);
        
        for (const fof of friendsOfFriend) {
          const potentialFriendId = fof.user_id === friendId ? fof.friend_id : fof.user_id;
          
          // Skip if it's the user or already a friend
          if (potentialFriendId === userId || friendIds.includes(potentialFriendId)) {
            continue;
          }

          // Count mutual friends
          const count = suggestions.get(potentialFriendId) || 0;
          suggestions.set(potentialFriendId, count + 1);
        }
      }

      // Sort by mutual friends count and get user details
      const sorted = Array.from(suggestions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const results = [];
      for (const [suggestedUserId, mutualCount] of sorted) {
        const user = await User.findById(suggestedUserId);
        if (user && !user.is_banned) {
          results.push({
            user_id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            mutual_friends: mutualCount,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error suggesting friends:', error);
      return [];
    }
  }
}

export default FriendService;
