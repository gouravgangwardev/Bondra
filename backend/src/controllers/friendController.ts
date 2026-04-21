// src/controllers/friendController.ts
import { Request, Response } from 'express';
import FriendService from '../services/friends/friendService';
import presenceTracker from '../services/friends/presenceTracker';
import { logger } from '../utils/logger';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';

export class FriendController {
  // Send friend request
  static async sendFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Friend ID is required',
        });
        return;
      }

      const result = await FriendService.sendFriendRequest(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.FRIEND_REQUEST_EXISTS,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in sendFriendRequest controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to send friend request',
      });
    }
  }

  // Accept friend request
  static async acceptFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Friend ID is required',
        });
        return;
      }

      const result = await FriendService.acceptFriendRequest(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in acceptFriendRequest controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to accept friend request',
      });
    }
  }

  // Reject friend request
  static async rejectFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Friend ID is required',
        });
        return;
      }

      const result = await FriendService.rejectFriendRequest(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in rejectFriendRequest controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to reject friend request',
      });
    }
  }

  // Remove friend
  static async removeFriend(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.params;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Friend ID is required',
        });
        return;
      }

      const result = await FriendService.removeFriend(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in removeFriend controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to remove friend',
      });
    }
  }

  // Block user
  static async blockUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'User ID is required',
        });
        return;
      }

      const result = await FriendService.blockUser(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in blockUser controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to block user',
      });
    }
  }

  // Unblock user
  static async unblockUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.params;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'User ID is required',
        });
        return;
      }

      const result = await FriendService.unblockUser(userId, friendId);

      if (!result.success) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in unblockUser controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to unblock user',
      });
    }
  }

  // Get friend list
  static async getFriendList(req: Request, res: Response): Promise<void> {
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

      const friends = await FriendService.getFriendList(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          friends,
          count: friends.length,
        },
      });
    } catch (error) {
      logger.error('Error in getFriendList controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get friend list',
      });
    }
  }

  // Get pending friend requests
  static async getPendingRequests(req: Request, res: Response): Promise<void> {
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

      const requests = await FriendService.getPendingRequests(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          requests,
          count: requests.length,
        },
      });
    } catch (error) {
      logger.error('Error in getPendingRequests controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get pending requests',
      });
    }
  }

  // Get sent friend requests
  static async getSentRequests(req: Request, res: Response): Promise<void> {
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

      const requests = await FriendService.getSentRequests(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          requests,
          count: requests.length,
        },
      });
    } catch (error) {
      logger.error('Error in getSentRequests controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get sent requests',
      });
    }
  }

  // Get online friends
  static async getOnlineFriends(req: Request, res: Response): Promise<void> {
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

      const friends = await FriendService.getOnlineFriends(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          friends,
          count: friends.length,
        },
      });
    } catch (error) {
      logger.error('Error in getOnlineFriends controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get online friends',
      });
    }
  }

  // Get friend statistics
  static async getFriendStats(req: Request, res: Response): Promise<void> {
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

      const stats = await FriendService.getFriendStats(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error in getFriendStats controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get friend stats',
      });
    }
  }

  // Get friend suggestions
  static async getFriendSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { limit = 10 } = req.query;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      const limitNum = Math.min(parseInt(limit as string) || 10, 50);
      const suggestions = await FriendService.suggestFriends(userId, limitNum);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          suggestions,
          count: suggestions.length,
        },
      });
    } catch (error) {
      logger.error('Error in getFriendSuggestions controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get friend suggestions',
      });
    }
  }

  // Check friendship status
  static async getFriendshipStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.params;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!friendId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Friend ID is required',
        });
        return;
      }

      const status = await FriendService.getFriendshipStatus(userId, friendId);
      const isOnline = await presenceTracker.isUserOnline(friendId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          friendshipStatus: status,
          isOnline,
        },
      });
    } catch (error) {
      logger.error('Error in getFriendshipStatus controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get friendship status',
      });
    }
  }
}

export default FriendController;