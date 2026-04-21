// ============================================
// FILE 1: src/jobs/sessionCleanup.ts
// ============================================
import { Session } from '../models/Session';
import { User } from '../models/User';
import sessionManager from '../services/matching/sessionManager';
import { logger } from '../utils/logger';
import { MetricsService } from '../config/monitoring';

export class SessionCleanupJob {
  private interval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly ABANDONED_SESSION_TIMEOUT = 60; // 60 minutes
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      logger.warn('Session cleanup job already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting session cleanup job');

    // Run immediately on start
    this.cleanup();

    // Then run on interval
    this.interval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      logger.info('Session cleanup job stopped');
    }
  }

  private async cleanup(): Promise<void> {
    const startTime = Date.now();
    logger.debug('Running session cleanup...');

    try {
      // 1. Clean up abandoned sessions
      const abandonedCount = await this.cleanupAbandonedSessions();

      // 2. Clean up stale Redis sessions
      const staleRedisCount = await this.cleanupStaleRedisSessions();

      // 3. Clean up old guest users
      const oldGuestsCount = await this.cleanupOldGuests();

      // 4. Update statistics
      await this.updateSessionStatistics();

      const duration = Date.now() - startTime;

      logger.info('Session cleanup completed', {
        duration: `${duration}ms`,
        abandonedSessions: abandonedCount,
        staleRedisSessions: staleRedisCount,
        oldGuests: oldGuestsCount,
      });

    } catch (error) {
      logger.error('Error in session cleanup:', error);
      MetricsService.trackError('job', 'session_cleanup_failed');
    }
  }

  private async cleanupAbandonedSessions(): Promise<number> {
    try {
      const count = await Session.cleanupAbandonedSessions(
        this.ABANDONED_SESSION_TIMEOUT
      );

      if (count > 0) {
        logger.info(`Cleaned up ${count} abandoned sessions`);
        MetricsService.sessionsEnded.labels('video', 'abandoned').inc(count);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning abandoned sessions:', error);
      return 0;
    }
  }

  private async cleanupStaleRedisSessions(): Promise<number> {
    try {
      // Get all active sessions from Redis
      const activeSessions = await sessionManager.getAllActiveSessions();
      let cleaned = 0;

      // Check each session in Redis against database
      for (const redisSession of activeSessions) {
        const dbSession = await Session.findById(redisSession.id);

        // If session doesn't exist in DB or is not active, remove from Redis
        if (!dbSession || dbSession.status !== 'active') {
          await sessionManager.endSession(redisSession.id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale Redis sessions`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error cleaning stale Redis sessions:', error);
      return 0;
    }
  }

  private async cleanupOldGuests(): Promise<number> {
    try {
      const count = await User.cleanupOldGuests();

      if (count > 0) {
        logger.info(`Cleaned up ${count} old guest users`);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning old guests:', error);
      return 0;
    }
  }

  private async updateSessionStatistics(): Promise<void> {
    try {
      const stats = await Session.getActiveSessionsByType();
      
      // Update metrics for each session type
      MetricsService.sessionsActive.labels('video').set(stats.video);
      MetricsService.sessionsActive.labels('audio').set(stats.audio);
      MetricsService.sessionsActive.labels('text').set(stats.text);

    } catch (error) {
      logger.error('Error updating session statistics:', error);
    }
  }

  isJobRunning(): boolean {
    return this.isRunning;
  }
}

export default new SessionCleanupJob();
