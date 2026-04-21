// src/controllers/authController.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth/authService';
import tokenService from '../services/auth/tokenService';
import { logger } from '../utils/logger';
import { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_CODES } from '../config/constants';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body;

      // Validate input
      if (!username || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Username and password are required',
        });
        return;
      }

      // Validate username format
      const usernameValidation = AuthService.validateUsername(username);
      if (!usernameValidation.valid) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: usernameValidation.errors[0],
        });
        return;
      }

      // Validate password strength
      const passwordValidation = AuthService.validatePassword(password);
      if (!passwordValidation.valid) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: passwordValidation.errors[0],
        });
        return;
      }

      // Validate email if provided
      if (email && !AuthService.validateEmail(email)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid email format',
        });
        return;
      }

      // Register user
      const result = await AuthService.register(username, email, password);

      if (!result) {
        res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          error: ERROR_CODES.USER_ALREADY_EXISTS,
          message: 'Username or email already exists',
        });
        return;
      }

      // Store refresh token
      await tokenService.storeRefreshToken(result.user.id!, result.refreshToken);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      logger.error('Error in register controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to register user',
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Username and password are required',
        });
        return;
      }

      // Login user
      const result = await AuthService.login(username, password);

      if (!result) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          message: 'Invalid username or password',
        });
        return;
      }

      // Store refresh token
      await tokenService.storeRefreshToken(result.user.id!, result.refreshToken);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      logger.error('Error in login controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to login',
      });
    }
  }

  // Create guest user
  static async createGuest(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.createGuest();

      if (!result) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to create guest user',
        });
        return;
      }

      // Store refresh token
      await tokenService.storeRefreshToken(result.user.id!, result.refreshToken);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Guest user created',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      logger.error('Error in createGuest controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create guest user',
      });
    }
  }

  // Refresh access token
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Refresh token is required',
        });
        return;
      }

      // Refresh access token
      const newAccessToken = await tokenService.refreshAccessToken(refreshToken);

      if (!newAccessToken) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid or expired refresh token',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      logger.error('Error in refreshToken controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to refresh token',
      });
    }
  }

  // Logout user
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Token is required',
        });
        return;
      }

      // Blacklist access token
      await tokenService.blacklistToken(token);

      // Revoke refresh token
      if (userId) {
        await tokenService.revokeRefreshToken(userId);
        await AuthService.logout(userId);
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
      });
    } catch (error) {
      logger.error('Error in logout controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to logout',
      });
    }
  }

  // Change password
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { oldPassword, newPassword } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!oldPassword || !newPassword) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Old and new passwords are required',
        });
        return;
      }

      // Validate new password
      const passwordValidation = AuthService.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: passwordValidation.errors[0],
        });
        return;
      }

      // Change password
      const success = await AuthService.changePassword(userId, oldPassword, newPassword);

      if (!success) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid old password',
        });
        return;
      }

      // Revoke all tokens (force re-login)
      await tokenService.revokeAllUserTokens(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      logger.error('Error in changePassword controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to change password',
      });
    }
  }

  // Verify token
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Token is required',
        });
        return;
      }

      // Bug 10 fix: explicitly pass 'access' so the type-claim check added in
      // Bug 9 is enforced here too — a refresh token must not verify as an access token.
      const decoded = await tokenService.validateToken(token, 'access');

      if (!decoded) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid or expired token',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Token is valid',
        data: {
          userId: decoded.userId,
          username: decoded.username,
          isGuest: decoded.isGuest,
        },
      });
    } catch (error) {
      logger.error('Error in verifyToken controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to verify token',
      });
    }
  }

  // Get current user
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
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

      const { User } = await import('../models/User');
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

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { user: userData },
      });
    } catch (error) {
      logger.error('Error in getCurrentUser controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get user',
      });
    }
  }
}

export default AuthController;
