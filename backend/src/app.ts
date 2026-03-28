// src/app.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { ENV } from './config/environment';
import { logger, loggerStream } from './utils/logger';
import { metricsMiddleware, getMetrics } from './config/monitoring';
import { HTTP_STATUS } from './config/constants';

// Import controllers
import AuthController from './controllers/authController';
import UserController from './controllers/userController';
import FriendController from './controllers/friendController';
import ReportController from './controllers/reportController';
import HealthController from './controllers/healthController';

// Import middleware
import { authMiddleware } from './middleware/authMiddleware';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    if (ENV.ENABLE_HELMET) {
      this.app.use(helmet({
        contentSecurityPolicy: false, // Disable for WebSocket
        crossOriginEmbedderPolicy: false,
      }));
    }

    // CORS configuration
    this.app.use(cors({
      origin: ENV.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // HTTP request logging
    if (ENV.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', { stream: loggerStream }));
    }

    // Metrics middleware
    this.app.use(metricsMiddleware);

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Trust proxy (for production behind load balancer)
    if (ENV.IS_PRODUCTION) {
      this.app.set('trust proxy', 1);
    }

    logger.info('Middlewares initialized');
  }

  private initializeRoutes(): void {
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Random Chat API',
        version: '1.0.0',
        environment: ENV.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
    });

    // Prometheus Metrics endpoint (must be before other routes)
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', 'text/plain');
        const metrics = await getMetrics();
        res.send(metrics);
      } catch (error) {
        logger.error('Error getting metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    });

    // Health check endpoints
    this.app.get('/health', HealthController.healthCheck);
    this.app.get('/health/detailed', HealthController.detailedHealthCheck);
    this.app.get('/health/ready', HealthController.readinessCheck);
    this.app.get('/health/live', HealthController.livenessCheck);

    // API routes
    const API_PREFIX = '/api/v1';

    // Auth routes (public)
    this.app.post(`${API_PREFIX}/auth/register`, AuthController.register);
    this.app.post(`${API_PREFIX}/auth/login`, AuthController.login);
    this.app.post(`${API_PREFIX}/auth/guest`, AuthController.createGuest);
    this.app.post(`${API_PREFIX}/auth/refresh`, AuthController.refreshToken);
    this.app.post(`${API_PREFIX}/auth/logout`, AuthController.logout);
    this.app.post(`${API_PREFIX}/auth/verify`, AuthController.verifyToken);

    // User routes — static/named routes MUST come before /:userId wildcard
    this.app.get(`${API_PREFIX}/users/search`, UserController.searchUsers);
    this.app.get(`${API_PREFIX}/users/active-count`, UserController.getActiveUsersCount);
    this.app.get(`${API_PREFIX}/users/check-username`, UserController.checkUsername);
    this.app.get(`${API_PREFIX}/users/stats`, authMiddleware, UserController.getUserStats);
    this.app.put(`${API_PREFIX}/users/profile`, authMiddleware, UserController.updateProfile);
    // Wildcard param route must be last so it doesn't swallow the static routes above
    this.app.get(`${API_PREFIX}/users/:userId`, authMiddleware, UserController.getUserProfile);

    // Friend routes (all protected)
    this.app.post(`${API_PREFIX}/friends/request`, authMiddleware, FriendController.sendFriendRequest);
    this.app.post(`${API_PREFIX}/friends/accept`, authMiddleware, FriendController.acceptFriendRequest);
    this.app.post(`${API_PREFIX}/friends/reject`, authMiddleware, FriendController.rejectFriendRequest);
    this.app.delete(`${API_PREFIX}/friends/:friendId`, authMiddleware, FriendController.removeFriend);
    this.app.post(`${API_PREFIX}/friends/block`, authMiddleware, FriendController.blockUser);
    this.app.delete(`${API_PREFIX}/friends/unblock/:friendId`, authMiddleware, FriendController.unblockUser);
    this.app.get(`${API_PREFIX}/friends`, authMiddleware, FriendController.getFriendList);
    this.app.get(`${API_PREFIX}/friends/pending`, authMiddleware, FriendController.getPendingRequests);
    this.app.get(`${API_PREFIX}/friends/sent`, authMiddleware, FriendController.getSentRequests);
    this.app.get(`${API_PREFIX}/friends/online`, authMiddleware, FriendController.getOnlineFriends);
    this.app.get(`${API_PREFIX}/friends/stats`, authMiddleware, FriendController.getFriendStats);
    this.app.get(`${API_PREFIX}/friends/suggestions`, authMiddleware, FriendController.getFriendSuggestions);
    this.app.get(`${API_PREFIX}/friends/:friendId/status`, authMiddleware, FriendController.getFriendshipStatus);

    // Report routes (all protected)
    this.app.post(`${API_PREFIX}/reports`, authMiddleware, ReportController.submitReport);
    this.app.get(`${API_PREFIX}/reports`, authMiddleware, ReportController.getAllReports);
    this.app.get(`${API_PREFIX}/reports/my`, authMiddleware, ReportController.getMyReports);
    this.app.get(`${API_PREFIX}/reports/pending-count`, authMiddleware, ReportController.getPendingCount);
    this.app.get(`${API_PREFIX}/reports/recent`, authMiddleware, ReportController.getRecentReports);
    this.app.get(`${API_PREFIX}/reports/stats`, authMiddleware, ReportController.getReportStats);
    this.app.get(`${API_PREFIX}/reports/:reportId`, authMiddleware, ReportController.getReportDetails);

    // Health & monitoring routes
    this.app.get(`${API_PREFIX}/health/system`, HealthController.getSystemStats);
    this.app.get(`${API_PREFIX}/health/app`, HealthController.getAppStats);
    this.app.get(`${API_PREFIX}/health/cache`, HealthController.getCacheStats);
    this.app.get(`${API_PREFIX}/health/database`, HealthController.getDatabaseStats);
    this.app.get(`${API_PREFIX}/health/queue`, HealthController.getQueueStats);
    this.app.get(`${API_PREFIX}/health/cluster`, HealthController.getClusterInfo);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Route not found',
        path: req.path,
      });
    });

    logger.info('Routes initialized');
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      // Log error
      logger.error('Global error handler:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      // Don't leak error details in production
      const isDevelopment = ENV.NODE_ENV === 'development';

      // Determine status code
      const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

      // Send error response
      res.status(statusCode).json({
        success: false,
        error: err.code || 'INTERNAL_ERROR',
        message: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString(),
      });
    });

    logger.info('Error handling initialized');
  }

  public getApp(): Application {
    return this.app;
  }
}

export default new App().getApp();
