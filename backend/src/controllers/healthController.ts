// src/controllers/healthController.ts
import { Request, Response } from 'express';
import { pool, getPoolStats } from '../config/database';
import { testRedisConnection } from '../config/redis';
import cacheService from '../services/cache/cacheService';
import sessionManager from '../services/matching/sessionManager';
import queueManager from '../services/matching/queueManager';
import LoadBalancer from '../services/matching/loadBalancer';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../config/constants';
import os from 'os';

export class HealthController {
  // Basic health check
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      };

      res.status(HTTP_STATUS.OK).json(health);
    } catch (error) {
      logger.error('Error in health check:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'error',
        message: 'Service unavailable',
      });
    }
  }

  // Detailed health check with dependencies
  static async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        checks: {
          database: 'unknown',
          redis: 'unknown',
          cache: 'unknown',
        },
        performance: {
          memory: process.memoryUsage(),
          cpu: os.loadavg(),
        },
      };

      let hasErrors = false;

      // Check PostgreSQL
      try {
        await pool.query('SELECT 1');
        health.checks.database = 'healthy';
      } catch (error) {
        health.checks.database = 'unhealthy';
        health.errors = health.errors || [];
        health.errors.push('Database connection failed');
        hasErrors = true;
        logger.error('Database health check failed:', error);
      }

      // Check Redis
      try {
        const redisHealthy = await testRedisConnection();
        health.checks.redis = redisHealthy ? 'healthy' : 'unhealthy';
        if (!redisHealthy) {
          hasErrors = true;
          health.errors = health.errors || [];
          health.errors.push('Redis connection failed');
        }
      } catch (error) {
        health.checks.redis = 'unhealthy';
        hasErrors = true;
        health.errors = health.errors || [];
        health.errors.push('Redis connection failed');
        logger.error('Redis health check failed:', error);
      }

      // Check Cache
      try {
        const cacheHealth = await cacheService.healthCheck();
        health.checks.cache = cacheHealth.healthy ? 'healthy' : 'unhealthy';
        if (!cacheHealth.healthy) {
          hasErrors = true;
          health.errors = health.errors || [];
          health.errors.push(`Cache check failed: ${cacheHealth.message}`);
        }
      } catch (error) {
        health.checks.cache = 'unhealthy';
        hasErrors = true;
        health.errors = health.errors || [];
        health.errors.push('Cache check failed');
        logger.error('Cache health check failed:', error);
      }

      health.status = hasErrors ? 'degraded' : 'ok';

      const statusCode = hasErrors 
        ? HTTP_STATUS.SERVICE_UNAVAILABLE 
        : HTTP_STATUS.OK;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Error in detailed health check:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Health check failed',
      });
    }
  }

  // Readiness check (for Kubernetes/load balancers)
  static async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if all critical services are ready
      const dbReady = await pool.query('SELECT 1').then(() => true).catch(() => false);
      const redisReady = await testRedisConnection();

      if (dbReady && redisReady) {
        res.status(HTTP_STATUS.OK).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          issues: {
            database: !dbReady,
            redis: !redisReady,
          },
        });
      }
    } catch (error) {
      logger.error('Error in readiness check:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'error',
        message: 'Readiness check failed',
      });
    }
  }

  // Liveness check (for Kubernetes)
  static async livenessCheck(req: Request, res: Response): Promise<void> {
    // Simple check to see if the process is alive
    res.status(HTTP_STATUS.OK).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  // Get system statistics
  static async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          uptime: os.uptime(),
          loadAverage: os.loadavg(),
        },
        process: {
          version: process.version,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },
        database: getPoolStats(),
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(stats);
    } catch (error) {
      logger.error('Error getting system stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to get system stats',
      });
    }
  }

  // Get application statistics
  static async getAppStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        sessionStats,
        queueSizes,
        clusterStats,
      ] = await Promise.all([
        sessionManager.getSessionStats(),
        queueManager.getAllQueueSizes(),
        LoadBalancer.getClusterStats(),
      ]);

      const stats = {
        sessions: sessionStats,
        queues: queueSizes,
        cluster: clusterStats,
        cache: cacheService.getStats(),
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(stats);
    } catch (error) {
      logger.error('Error getting app stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to get application stats',
      });
    }
  }

  // Get cache statistics
  static async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = cacheService.getStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get cache stats',
      });
    }
  }

  // Get database statistics
  static async getDatabaseStats(req: Request, res: Response): Promise<void> {
    try {
      const poolStats = getPoolStats();

      const stats = {
        pool: poolStats,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error getting database stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get database stats',
      });
    }
  }

  // Get queue statistics
  static async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await queueManager.getQueueStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get queue stats',
      });
    }
  }

  // Get cluster information
  static async getClusterInfo(req: Request, res: Response): Promise<void> {
    try {
      const clusterStats = await LoadBalancer.getClusterStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { cluster: clusterStats },
      });
    } catch (error) {
      logger.error('Error getting cluster info:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get cluster info',
      });
    }
  }

  // Reset cache statistics
  static async resetCacheStats(req: Request, res: Response): Promise<void> {
    try {
      cacheService.resetStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Cache statistics reset',
      });
    } catch (error) {
      logger.error('Error resetting cache stats:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to reset cache stats',
      });
    }
  }
}

export default HealthController;