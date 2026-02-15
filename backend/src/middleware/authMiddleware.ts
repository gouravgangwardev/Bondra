// ============================================
// FILE 1: src/middleware/authMiddleware.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import tokenService from '../services/auth/tokenService';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    isGuest: boolean;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Validate token
    const decoded = await tokenService.validateToken(token, 'access');

    if (!decoded) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Check if user exists and is not banned
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_CODES.USER_NOT_FOUND,
        message: 'User not found',
      });
      return;
    }

    if (user.is_banned) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: ERROR_CODES.USER_BANNED,
        message: 'User is banned',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      isGuest: decoded.isGuest,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Authentication error',
    });
  }
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await tokenService.validateToken(token, 'access');
      
      if (decoded) {
        const user = await User.findById(decoded.userId);
        if (user && !user.is_banned) {
          req.user = {
            userId: decoded.userId,
            username: decoded.username,
            isGuest: decoded.isGuest,
          };
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};

// Check if user is admin (for admin routes)
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Authentication required',
    });
    return;
  }

  // Check if user is admin (implement your admin check logic)
  // For now, we'll just check if username is 'admin'
  if (req.user.username !== 'admin') {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Admin access required',
    });
    return;
  }

  next();
};

// Check if user is not a guest
export const registeredUserOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.isGuest) {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Registered users only',
    });
    return;
  }

  next();
};
