// ============================================
// FILE 5: src/utils/asyncHandler.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wrapper for async route handlers
 * Automatically catches errors and passes them to error middleware
 */
export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler error:', {
        path: req.path,
        method: req.method,
        error: error.message,
        stack: error.stack,
      });
      next(error);
    });
  };
};

/**
 * Wrapper for async middleware
 */
export const asyncMiddleware = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrapper with timeout
 */
export const asyncHandlerWithTimeout = (
  fn: AsyncFunction,
  timeout: number = 30000
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    Promise.race([fn(req, res, next), timeoutPromise]).catch((error) => {
      logger.error('Async handler timeout:', {
        path: req.path,
        method: req.method,
        timeout,
        error: error.message,
      });
      next(error);
    });
  };
};

/**
 * Wrapper with retry logic
 */
export const asyncHandlerWithRetry = (
  fn: AsyncFunction,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(req, res, next);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
            path: req.path,
            error: lastError.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    logger.error(`All ${maxRetries} retry attempts failed`, {
      path: req.path,
      error: lastError!.message,
    });
    next(lastError!);
  };
};

export default asyncHandler;
