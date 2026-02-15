// src/models/Friendship.ts
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { FriendshipStatus } from '../config/constants';

export interface IFriendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
}

export interface IFriendWithDetails {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  friend_username: string;
  friend_avatar_url: string | null;
  friend_last_seen: Date;
  created_at: Date;
}

export class Friendship {
  // Send friend request
  static async sendRequest(userId: string, friendId: string): Promise<IFriendship | null> {
    try {
      // Check if request already exists
      const existing = await this.findFriendship(userId, friendId);
      if (existing) {
        logger.warn(`Friendship already exists between ${userId} and ${friendId}`);
        return null;
      }

      const result = await query(
        `INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [userId, friendId, FriendshipStatus.PENDING]
      );

      logger.info(`Friend request sent from ${userId} to ${friendId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error sending friend request:', error);
      return null;
    }
  }

  // Accept friend request
  static async acceptRequest(userId: string, friendId: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE friendships 
         SET status = $1, updated_at = NOW()
         WHERE friend_id = $2 AND user_id = $3 AND status = $4
         RETURNING *`,
        [FriendshipStatus.ACCEPTED, userId, friendId, FriendshipStatus.PENDING]
      );

      if (result.rows.length === 0) {
        logger.warn(`No pending friend request found from ${friendId} to ${userId}`);
        return false;
      }

      logger.info(`Friend request accepted: ${friendId} -> ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error accepting friend request:', error);
      return false;
    }
  }

  // Reject friend request
  static async rejectRequest(userId: string, friendId: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE friendships 
         SET status = $1, updated_at = NOW()
         WHERE friend_id = $2 AND user_id = $3 AND status = $4
         RETURNING *`,
        [FriendshipStatus.REJECTED, userId, friendId, FriendshipStatus.PENDING]
      );

      if (result.rows.length === 0) {
        return false;
      }

      logger.info(`Friend request rejected: ${friendId} -> ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error rejecting friend request:', error);
      return false;
    }
  }

  // Remove friend (delete friendship)
  static async removeFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      await query(
        `DELETE FROM friendships 
         WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)`,
        [userId, friendId]
      );

      logger.info(`Friendship removed between ${userId} and ${friendId}`);
      return true;
    } catch (error) {
      logger.error('Error removing friend:', error);
      return false;
    }
  }

  // Block user
  static async blockUser(userId: string, friendId: string): Promise<boolean> {
    try {
      // First, remove existing friendship if any
      await this.removeFriend(userId, friendId);

      // Create blocked relationship
      await query(
        `INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id, friend_id) 
         DO UPDATE SET status = $3, updated_at = NOW()`,
        [userId, friendId, FriendshipStatus.BLOCKED]
      );

      logger.info(`User ${friendId} blocked by ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error blocking user:', error);
      return false;
    }
  }

  // Unblock user
  static async unblockUser(userId: string, friendId: string): Promise<boolean> {
    try {
      await query(
        `DELETE FROM friendships 
         WHERE user_id = $1 AND friend_id = $2 AND status = $3`,
        [userId, friendId, FriendshipStatus.BLOCKED]
      );

      logger.info(`User ${friendId} unblocked by ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error unblocking user:', error);
      return false;
    }
  }

  // Get friend list with details
  static async getFriends(userId: string): Promise<IFriendWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          f.id, f.user_id, f.friend_id, f.status, f.created_at,
          u.username as friend_username,
          u.avatar_url as friend_avatar_url,
          u.last_seen as friend_last_seen
         FROM friendships f
         JOIN users u ON (
           CASE 
             WHEN f.user_id = $1 THEN u.id = f.friend_id
             ELSE u.id = f.user_id
           END
         )
         WHERE (f.user_id = $1 OR f.friend_id = $1) 
         AND f.status = $2
         ORDER BY u.last_seen DESC`,
        [userId, FriendshipStatus.ACCEPTED]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting friends:', error);
      return [];
    }
  }

  // Get pending friend requests (received)
  static async getPendingRequests(userId: string): Promise<IFriendWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          f.id, f.user_id, f.friend_id, f.status, f.created_at,
          u.username as friend_username,
          u.avatar_url as friend_avatar_url,
          u.last_seen as friend_last_seen
         FROM friendships f
         JOIN users u ON u.id = f.user_id
         WHERE f.friend_id = $1 AND f.status = $2
         ORDER BY f.created_at DESC`,
        [userId, FriendshipStatus.PENDING]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting pending requests:', error);
      return [];
    }
  }

  // Get sent friend requests
  static async getSentRequests(userId: string): Promise<IFriendWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          f.id, f.user_id, f.friend_id, f.status, f.created_at,
          u.username as friend_username,
          u.avatar_url as friend_avatar_url,
          u.last_seen as friend_last_seen
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1 AND f.status = $2
         ORDER BY f.created_at DESC`,
        [userId, FriendshipStatus.PENDING]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting sent requests:', error);
      return [];
    }
  }

  // Get blocked users
  static async getBlockedUsers(userId: string): Promise<IFriendWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          f.id, f.user_id, f.friend_id, f.status, f.created_at,
          u.username as friend_username,
          u.avatar_url as friend_avatar_url,
          u.last_seen as friend_last_seen
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1 AND f.status = $2
         ORDER BY f.created_at DESC`,
        [userId, FriendshipStatus.BLOCKED]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting blocked users:', error);
      return [];
    }
  }

  // Check if users are friends
  static async areFriends(userId: string, friendId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
         AND status = $3
         LIMIT 1`,
        [userId, friendId, FriendshipStatus.ACCEPTED]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking friendship:', error);
      return false;
    }
  }

  // Check if user is blocked
  static async isBlocked(userId: string, friendId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
         AND status = $3
         LIMIT 1`,
        [userId, friendId, FriendshipStatus.BLOCKED]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking block status:', error);
      return false;
    }
  }

  // Find friendship (any status)
  static async findFriendship(userId: string, friendId: string): Promise<IFriendship | null> {
    try {
      const result = await query(
        `SELECT * FROM friendships 
         WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
         LIMIT 1`,
        [userId, friendId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding friendship:', error);
      return null;
    }
  }

  // Get friendship status
  static async getStatus(userId: string, friendId: string): Promise<FriendshipStatus | null> {
    try {
      const friendship = await this.findFriendship(userId, friendId);
      return friendship?.status || null;
    } catch (error) {
      logger.error('Error getting friendship status:', error);
      return null;
    }
  }

  // Get friend count
  static async getFriendCount(userId: string): Promise<number> {
    try {
      const result = await query(
        `SELECT COUNT(*) FROM friendships 
         WHERE (user_id = $1 OR friend_id = $1) AND status = $2`,
        [userId, FriendshipStatus.ACCEPTED]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting friend count:', error);
      return 0;
    }
  }

  // Get online friends
  static async getOnlineFriends(userId: string): Promise<IFriendWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          f.id, f.user_id, f.friend_id, f.status, f.created_at,
          u.username as friend_username,
          u.avatar_url as friend_avatar_url,
          u.last_seen as friend_last_seen
         FROM friendships f
         JOIN users u ON (
           CASE 
             WHEN f.user_id = $1 THEN u.id = f.friend_id
             ELSE u.id = f.user_id
           END
         )
         WHERE (f.user_id = $1 OR f.friend_id = $1) 
         AND f.status = $2
         AND u.last_seen > NOW() - INTERVAL '5 minutes'
         ORDER BY u.last_seen DESC`,
        [userId, FriendshipStatus.ACCEPTED]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting online friends:', error);
      return [];
    }
  }

  // Get mutual friends
  static async getMutualFriends(userId1: string, userId2: string): Promise<string[]> {
    try {
      const result = await query(
        `SELECT 
          CASE 
            WHEN f1.user_id = $1 THEN f1.friend_id
            ELSE f1.user_id
          END as mutual_friend_id
         FROM friendships f1
         JOIN friendships f2 ON (
           (f1.user_id = $1 OR f1.friend_id = $1) AND
           (f2.user_id = $2 OR f2.friend_id = $2) AND
           (
             (f1.user_id = f2.user_id) OR
             (f1.user_id = f2.friend_id) OR
             (f1.friend_id = f2.user_id) OR
             (f1.friend_id = f2.friend_id)
           )
         )
         WHERE f1.status = $3 AND f2.status = $3`,
        [userId1, userId2, FriendshipStatus.ACCEPTED]
      );

      return result.rows.map(row => row.mutual_friend_id);
    } catch (error) {
      logger.error('Error getting mutual friends:', error);
      return [];
    }
  }
}

export default Friendship;
