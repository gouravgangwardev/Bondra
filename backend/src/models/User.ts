// src/models/User.ts
import { pool, query } from '../config/database';
import bcrypt from 'bcrypt';
import { ENV } from '../config/environment';
import { logger } from '../utils/logger';

export interface IUser {
  id: string;
  username: string;
  email: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  is_guest: boolean;
  is_banned: boolean;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IUserCreate {
  username: string;
  email?: string;
  password?: string;
  is_guest?: boolean;
}

export interface IUserUpdate {
  username?: string;
  email?: string;
  avatar_url?: string;
  last_seen?: Date;
}

export class User {
  // Create a new user
  static async create(userData: IUserCreate): Promise<IUser | null> {
    try {
      const { username, email, password, is_guest = false } = userData;
      
      // Hash password if provided
      let password_hash = null;
      if (password) {
        password_hash = await bcrypt.hash(password, ENV.BCRYPT_ROUNDS);
      }

      const result = await query(
        `INSERT INTO users (username, email, password_hash, is_guest, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [username, email || null, password_hash, is_guest]
      );

      logger.info(`User created: ${username}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  // Find user by ID
  static async findById(id: string): Promise<IUser | null> {
    try {
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      return null;
    }
  }

  // Find user by username
  static async findByUsername(username: string): Promise<IUser | null> {
    try {
      const result = await query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      return null;
    }
  }

  // Find user by email
  static async findByEmail(email: string): Promise<IUser | null> {
    try {
      const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      return null;
    }
  }

  // Verify password
  static async verifyPassword(user: IUser, password: string): Promise<boolean> {
    try {
      if (!user.password_hash) return false;
      return await bcrypt.compare(password, user.password_hash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  // Update user
  static async update(id: string, updates: IUserUpdate): Promise<IUser | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.username !== undefined) {
        fields.push(`username = $${paramIndex++}`);
        values.push(updates.username);
      }
      if (updates.email !== undefined) {
        fields.push(`email = $${paramIndex++}`);
        values.push(updates.email);
      }
      if (updates.avatar_url !== undefined) {
        fields.push(`avatar_url = $${paramIndex++}`);
        values.push(updates.avatar_url);
      }
      if (updates.last_seen !== undefined) {
        fields.push(`last_seen = $${paramIndex++}`);
        values.push(updates.last_seen);
      }

      if (fields.length === 0) return null;

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating user:', error);
      return null;
    }
  }

  // Update last seen
  static async updateLastSeen(id: string): Promise<boolean> {
    try {
      await query(
        'UPDATE users SET last_seen = NOW(), updated_at = NOW() WHERE id = $1',
        [id]
      );
      return true;
    } catch (error) {
      logger.error('Error updating last seen:', error);
      return false;
    }
  }

  // Ban/unban user
  static async setBanStatus(id: string, isBanned: boolean): Promise<boolean> {
    try {
      await query(
        'UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2',
        [isBanned, id]
      );
      logger.info(`User ${id} ban status: ${isBanned}`);
      return true;
    } catch (error) {
      logger.error('Error updating ban status:', error);
      return false;
    }
  }

  // Delete user (soft delete by marking as banned)
  static async delete(id: string): Promise<boolean> {
    try {
      await query(
        'UPDATE users SET is_banned = true, updated_at = NOW() WHERE id = $1',
        [id]
      );
      logger.info(`User deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      return false;
    }
  }

  // Get user statistics
  static async getStats(id: string): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          (SELECT COUNT(*) FROM sessions WHERE user1_id = $1 OR user2_id = $1) as total_sessions,
          (SELECT COUNT(*) FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted') as total_friends,
          (SELECT COUNT(*) FROM reports WHERE reporter_id = $1) as reports_made,
          (SELECT COUNT(*) FROM reports WHERE reported_user_id = $1) as reports_received
        `,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    }
  }

  // Check if username exists
  static async usernameExists(username: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT 1 FROM users WHERE username = $1 LIMIT 1',
        [username]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking username existence:', error);
      return false;
    }
  }

  // Check if email exists
  static async emailExists(email: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking email existence:', error);
      return false;
    }
  }

  // Get active users count
  static async getActiveUsersCount(): Promise<number> {
    try {
      const result = await query(
        "SELECT COUNT(*) FROM users WHERE last_seen > NOW() - INTERVAL '5 minutes'",
        []
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting active users count:', error);
      return 0;
    }
  }

  // Get all users (paginated)
  static async getAll(page: number = 1, limit: number = 20): Promise<IUser[]> {
    try {
      const offset = (page - 1) * limit;
      const result = await query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting all users:', error);
      return [];
    }
  }

  // Search users by username
  static async search(searchTerm: string, limit: number = 10): Promise<IUser[]> {
    try {
      const result = await query(
        `SELECT id, username, avatar_url, created_at 
         FROM users 
         WHERE username ILIKE $1 AND is_banned = false
         LIMIT $2`,
        [`%${searchTerm}%`, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error searching users:', error);
      return [];
    }
  }

  // Create guest user
  static async createGuest(): Promise<IUser | null> {
    try {
      const guestUsername = `Guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await query(
        `INSERT INTO users (username, is_guest, created_at, updated_at)
         VALUES ($1, true, NOW(), NOW())
         RETURNING *`,
        [guestUsername]
      );

      logger.info(`Guest user created: ${guestUsername}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating guest user:', error);
      return null;
    }
  }

  // Clean up old guest users (older than 7 days)
  static async cleanupOldGuests(): Promise<number> {
    try {
      const result = await query(
        `DELETE FROM users 
         WHERE is_guest = true 
         AND created_at < NOW() - INTERVAL '7 days'
         RETURNING id`,
        []
      );
      
      const count = result.rows.length;
      if (count > 0) {
        logger.info(`Cleaned up ${count} old guest users`);
      }
      
      return count;
    } catch (error) {
      logger.error('Error cleaning up guest users:', error);
      return 0;
    }
  }
}

export default User;