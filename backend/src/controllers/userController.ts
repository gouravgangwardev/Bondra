// src/controllers/userController.ts
import { Request, Response } from 'express';
import { User } from '../models/User';
import cacheService from '../services/cache/cacheService';
import { CACHE_KEYS, CACHE_TTL_VALUES } from '../services/cache/cacheKeys';
import { logger } from '../utils/logger';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../config/constants';

export class UserController {
  // Get user profile by ID
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'User ID is required',
        });
        return;
      }

      // Try cache first
      const cachedUser = await cacheService.get(
        CACHE_KEYS.USER.PROFILE(userId)
      );

      if (cachedUser) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: { user: cachedUser },
          cached: true,
        });
        return;
      }

      // Get from database
      const user = await User.findById(userId);

      if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found',
        });
        return;
      }

      // Remove sensitive data
      const { password_hash, ...userData } = user;

      // Cache the result
      await cacheService.set(
        CACHE_KEYS.USER.PROFILE(userId),
        userData,
        { ttl: CACHE_TTL_VALUES.USER_PROFILE }
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { user: userData },
      });
    } catch (error) {
      logger.error('Error in getUserProfile controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get user profile',
      });
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { username, email, avatar_url } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      // Validate username if provided
      if (username) {
        const usernameExists = await User.usernameExists(username);
        const currentUser = await User.findById(userId);
        
        if (usernameExists && currentUser?.username !== username) {
          res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            error: ERROR_CODES.USER_ALREADY_EXISTS,
            message: 'Username already taken',
          });
          return;
        }
      }

      // Update user
      const updatedUser = await User.update(userId, {
        username,
        email,
        avatar_url,
      });

      if (!updatedUser) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found',
        });
        return;
      }

      // Invalidate cache
      await cacheService.delete(CACHE_KEYS.USER.PROFILE(userId));

      // Remove sensitive data
      const { password_hash, ...userData } = updatedUser;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: userData },
      });
    } catch (error) {
      logger.error('Error in updateProfile controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to update profile',
      });
    }
  }

  // Search users
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Search query is required',
        });
        return;
      }

      const limitNum = Math.min(parseInt(limit as string) || 10, 50);

      // Search users
      const users = await User.search(query, limitNum);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          users,
          count: users.length,
        },
      });
    } catch (error) {
      logger.error('Error in searchUsers controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to search users',
      });
    }
  }

  // Get user statistics
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      // Try cache first
      const cachedStats = await cacheService.get(
        CACHE_KEYS.USER.STATS(userId)
      );

      if (cachedStats) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: { stats: cachedStats },
          cached: true,
        });
        return;
      }

      // Get stats from database
      const stats = await User.getStats(userId);

      if (!stats) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found',
        });
        return;
      }

      // Cache for 5 minutes
      await cacheService.set(
        CACHE_KEYS.USER.STATS(userId),
        stats,
        { ttl: 300 }
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error in getUserStats controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get user stats',
      });
    }
  }

  // Get active users count
  static async getActiveUsersCount(req: Request, res: Response): Promise<void> {
    try {
      const count = await User.getActiveUsersCount();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { activeUsers: count },
      });
    } catch (error) {
      logger.error('Error in getActiveUsersCount controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get active users count',
      });
    }
  }

  // Delete user account
  static async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { password } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      // Verify password before deletion
      const user = await User.findById(userId);
      if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found',
        });
        return;
      }

      // Don't require password for guest users
      if (!user.is_guest) {
        if (!password) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'Password is required to delete account',
          });
          return;
        }

        const isValidPassword = await User.verifyPassword(user, password);
        if (!isValidPassword) {
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
            message: 'Invalid password',
          });
          return;
        }
      }

      // Delete user (soft delete - just ban)
      await User.delete(userId);

      // Invalidate cache
      await cacheService.delete(CACHE_KEYS.USER.PROFILE(userId));
      await cacheService.delete(CACHE_KEYS.USER.STATS(userId));

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      logger.error('Error in deleteAccount controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to delete account',
      });
    }
  }

  // Get all users (admin only - implement admin middleware separately)
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;

      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const limitNum = Math.min(
        parseInt(limit as string) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
      );

      const users = await User.getAll(pageNum, limitNum);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          users,
          page: pageNum,
          limit: limitNum,
          count: users.length,
        },
      });
    } catch (error) {
      logger.error('Error in getAllUsers controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get users',
      });
    }
  }

  // Update last seen
  static async updateLastSeen(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      await User.updateLastSeen(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Last seen updated',
      });
    } catch (error) {
      logger.error('Error in updateLastSeen controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to update last seen',
      });
    }
  }

  // Check username availability
  static async checkUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Username is required',
        });
        return;
      }

      const exists = await User.usernameExists(username);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          username,
          available: !exists,
        },
      });
    } catch (error) {
      logger.error('Error in checkUsername controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to check username',
      });
    }
  }
}

export default UserController;