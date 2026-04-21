// ============================================
// FILE 4: src/middleware/requestLogger.ts
// ============================================
import morgan from 'morgan';
import { logger, loggerStream } from '../utils/logger';
import { ENV } from '../config/environment';
import { Request, Response } from 'express';

// Custom token for user ID
morgan.token('user-id', (req: any) => {
  return req.user?.userId || 'anonymous';
});

// Custom token for request duration
morgan.token('response-time-ms', (req: Request, res: Response) => {
  if (!req['_startTime']) return '0';
  const ms = Date.now() - req['_startTime'];
  return ms.toFixed(2);
});

// Development format (colorized, detailed)
const devFormat = ':method :url :status :response-time ms - :res[content-length] - :user-id';

// Production format (JSON structured)
const prodFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  contentLength: ':res[content-length]',
  userId: ':user-id',
  ip: ':remote-addr',
  userAgent: ':user-agent',
});

// Request logger middleware
export const requestLogger = ENV.IS_DEVELOPMENT
  ? morgan(devFormat)
  : morgan(prodFormat, {
      stream: loggerStream,
    });

// Detailed request logger (for debugging)
export const detailedRequestLogger = (
  req: Request,
  res: Response,
  next: Function
): void => {
  req['_startTime'] = Date.now();

  // Log request
  logger.http('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as any).user?.userId,
    userAgent: req.get('user-agent'),
    body: req.body,
    query: req.query,
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - req['_startTime'];
    
    logger.http('Response sent', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    });

    return originalSend.call(this, data);
  };

  next();
};

// Skip logging for health checks
export const skipHealthCheck = (req: Request, res: Response) => {
  return req.url === '/health' || req.url === '/metrics';
};

// Request logger with skip option
export const requestLoggerWithSkip = morgan(
  ENV.IS_DEVELOPMENT ? devFormat : prodFormat,
  {
    stream: loggerStream,
    skip: skipHealthCheck,
  }
);