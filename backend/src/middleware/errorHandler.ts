// ============================================
// FILE 3: src/middleware/errorHandler.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ENV } from '../config/environment';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';
import { MetricsService } from '../config/monitoring';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Track error metrics
  if (err instanceof AppError) {
    MetricsService.trackError('application', err.code);
  } else {
    MetricsService.trackError('system', 'UNKNOWN_ERROR');
  }

  // Log error
  logger.error('Error caught by error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
  });

  // Handle different error types
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(ENV.IS_DEVELOPMENT && { stack: err.stack }),
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: ERROR_CODES.VALIDATION_ERROR,
      message: err.message,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: ERROR_CODES.AUTH_TOKEN_INVALID,
      message: 'Invalid token',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: ERROR_CODES.AUTH_TOKEN_EXPIRED,
      message: 'Token expired',
    });
    return;
  }

  // Handle database errors
  if (err.message?.includes('duplicate key')) {
    res.status(HTTP_STATUS.CONFLICT).json({
      success: false,
      error: ERROR_CODES.USER_ALREADY_EXISTS,
      message: 'Resource already exists',
    });
    return;
  }

  // Default error response
  const statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = ENV.IS_PRODUCTION
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: ERROR_CODES.INTERNAL_ERROR,
    message,
    ...(ENV.IS_DEVELOPMENT && { stack: err.stack }),
  });
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
  });
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
