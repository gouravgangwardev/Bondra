// ============================================
// FILE 3: src/jobs/metricsAggregator.ts
// ============================================
import { User } from '../models/User';
import { Session } from '../models/Session';
import { Friendship } from '../models/Friendship';
import { Report } from '../models/Report';
import presenceTracker from '../services/friends/presenceTracker';
import { logger } from '../utils/logger';
import { MetricsService } from '../config/monitoring';
import cacheService from '../services/cache/cacheService';
import { CACHE_KEYS } from '../services/cache/cacheKeys';

export class MetricsAggregatorJob {
  private interval: NodeJS.Timeout | null = null;
  private readonly AGGREGATION_INTERVAL = 60 * 1000; // 1 minute
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      logger.warn('Metrics aggregator job already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting metrics aggregator job');

    // Run immediately on start
    this.aggregate();

    // Then run on interval
    this.interval = setInterval(() => {
      this.aggregate();
    }, this.AGGREGATION_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      logger.info('Metrics aggregator job stopped');
    }
  }

  private async aggregate(): Promise<void> {
    const startTime = Date.now();

    try {
      // Aggregate all metrics
      await Promise.all([
        this.aggregateUserMetrics(),
        this.aggregateSessionMetrics(),
        this.aggregateFriendMetrics(),
        this.aggregateReportMetrics(),
        this.aggregateSystemMetrics(),
      ]);

      const duration = Date.now() - startTime;
      logger.debug(`Metrics aggregation completed in ${duration}ms`);

    } catch (error) {
      logger.error('Error in metrics aggregation:', error);
      MetricsService.trackError('job', 'metrics_aggregation_failed');
    }
  }

  private async aggregateUserMetrics(): Promise<void> {
    try {
      // Get user statistics
      const [totalUsers, activeUsers, onlineUsers] = await Promise.all([
        User.getAll(1, 1).then(users => User.getAll(1, 1000000).then(all => all.length)),
        User.getActiveUsersCount(),
        presenceTracker.getOnlineUsersCount(),
      ]);

      // Update metrics
      MetricsService.usersOnline.set(onlineUsers);

      // Cache statistics
      await cacheService.set(
        'metrics:users',
        {
          total: totalUsers,
          active: activeUsers,
          online: onlineUsers,
          timestamp: Date.now(),
        },
        { ttl: 60 }
      );

      logger.debug('User metrics aggregated', {
        total: totalUsers,
        active: activeUsers,
        online: onlineUsers,
      });

    } catch (error) {
      logger.error('Error aggregating user metrics:', error);
    }
  }

  private async aggregateSessionMetrics(): Promise<void> {
    try {
      // Get session statistics
      const [platformStats, activeByType] = await Promise.all([
        Session.getPlatformStats(),
        Session.getActiveSessionsByType(),
      ]);

      // Update metrics
      if (activeByType) {
        MetricsService.sessionsActive.labels('video').set(activeByType.video || 0);
        MetricsService.sessionsActive.labels('audio').set(activeByType.audio || 0);
        MetricsService.sessionsActive.labels('text').set(activeByType.text || 0);
      }

      // Cache statistics
      await cacheService.set(
        'metrics:sessions',
        {
          platform: platformStats,
          activeByType,
          timestamp: Date.now(),
        },
        { ttl: 60 }
      );

      logger.debug('Session metrics aggregated', { platformStats, activeByType });

    } catch (error) {
      logger.error('Error aggregating session metrics:', error);
    }
  }

  private async aggregateFriendMetrics(): Promise<void> {
    try {
      // Get friendship statistics
      const presenceStats = await presenceTracker.getPresenceStats();

      // Cache statistics
      await cacheService.set(
        'metrics:friends',
        {
          presence: presenceStats,
          timestamp: Date.now(),
        },
        { ttl: 60 }
      );

      logger.debug('Friend metrics aggregated', { presenceStats });

    } catch (error) {
      logger.error('Error aggregating friend metrics:', error);
    }
  }

  private async aggregateReportMetrics(): Promise<void> {
    try {
      // Get report statistics
      const [overallStats, pendingCount] = await Promise.all([
        Report.getOverallStats(),
        Report.getPendingCount(),
      ]);

      // Cache statistics
      await cacheService.set(
        'metrics:reports',
        {
          overall: overallStats,
          pending: pendingCount,
          timestamp: Date.now(),
        },
        { ttl: 60 }
      );

      logger.debug('Report metrics aggregated', { overallStats, pendingCount });

    } catch (error) {
      logger.error('Error aggregating report metrics:', error);
    }
  }

  private async aggregateSystemMetrics(): Promise<void> {
    try {
      const { getPoolStats } = await import('../config/database');
      const poolStats = getPoolStats();

      // Update database pool metrics
      MetricsService.updateDatabasePool(
        poolStats.total,
        poolStats.idle,
        poolStats.waiting
      );

      // Get cache statistics
      const cacheStats = cacheService.getStats();

      // Cache system statistics
      await cacheService.set(
        'metrics:system',
        {
          database: poolStats,
          cache: cacheStats,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          timestamp: Date.now(),
        },
        { ttl: 60 }
      );

      logger.debug('System metrics aggregated', { poolStats, cacheStats });

    } catch (error) {
      logger.error('Error aggregating system metrics:', error);
    }
  }

  async getAggregatedMetrics(): Promise<any> {
    try {
      // Get all cached metrics
      const [users, sessions, friends, reports, system] = await Promise.all([
        cacheService.get('metrics:users'),
        cacheService.get('metrics:sessions'),
        cacheService.get('metrics:friends'),
        cacheService.get('metrics:reports'),
        cacheService.get('metrics:system'),
      ]);

      return {
        users,
        sessions,
        friends,
        reports,
        system,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting aggregated metrics:', error);
      return null;
    }
  }

  isJobRunning(): boolean {
    return this.isRunning;
  }
}

export default new MetricsAggregatorJob();

// ============================================
// FILE 4: src/jobs/index.ts - Job Manager
// ============================================
import sessionCleanupJob from './sessionCleanup';
import queueMonitorJob from './queueMonitor';
import metricsAggregatorJob from './metricsAggregator';
import { logger } from '../utils/logger';

export class JobManager {
  private jobs = {
    sessionCleanup: sessionCleanupJob,
    queueMonitor: queueMonitorJob,
    metricsAggregator: metricsAggregatorJob,
  };

  startAll(): void {
    logger.info('Starting all background jobs...');
    
    this.jobs.sessionCleanup.start();
    this.jobs.queueMonitor.start();
    this.jobs.metricsAggregator.start();

    logger.info('All background jobs started');
  }

  stopAll(): void {
    logger.info('Stopping all background jobs...');
    
    this.jobs.sessionCleanup.stop();
    this.jobs.queueMonitor.stop();
    this.jobs.metricsAggregator.stop();

    logger.info('All background jobs stopped');
  }

  getStatus(): any {
    return {
      sessionCleanup: this.jobs.sessionCleanup.isJobRunning(),
      queueMonitor: this.jobs.queueMonitor.isJobRunning(),
      metricsAggregator: this.jobs.metricsAggregator.isJobRunning(),
    };
  }

  async getHealth(): Promise<any> {
    try {
      const [queueHealth, metrics] = await Promise.all([
        this.jobs.queueMonitor.getQueueHealth(),
        this.jobs.metricsAggregator.getAggregatedMetrics(),
      ]);

      return {
        healthy: queueHealth.healthy,
        jobs: this.getStatus(),
        queue: queueHealth,
        metrics,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting job health:', error);
      return {
        healthy: false,
        error: 'Failed to get job health',
      };
    }
  }
}

export default new JobManager();
