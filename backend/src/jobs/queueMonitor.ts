// ============================================
// FILE 2: src/jobs/queueMonitor.ts
// ============================================
import queueManager from '../services/matching/queueManager';
import { logger } from '../utils/logger';
import { MetricsService } from '../config/monitoring';
import { MONITORING } from '../config/constants';
import { SessionType } from '../config/constants';

export class QueueMonitorJob {
  private interval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL = 30 * 1000; // 30 seconds
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      logger.warn('Queue monitor job already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting queue monitor job');

    // Run immediately on start
    this.monitor();

    // Then run on interval
    this.interval = setInterval(() => {
      this.monitor();
    }, this.MONITOR_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      logger.info('Queue monitor job stopped');
    }
  }

  private async monitor(): Promise<void> {
    try {
      // Get queue stats
      const stats = await queueManager.getQueueStats();

      if (!stats) {
        logger.warn('Failed to get queue stats');
        return;
      }

      // Monitor each queue
      await this.monitorQueue(SessionType.VIDEO, stats.sizes.video);
      await this.monitorQueue(SessionType.AUDIO, stats.sizes.audio);
      await this.monitorQueue(SessionType.TEXT, stats.sizes.text);

      // Check for queue anomalies
      await this.checkQueueHealth(stats);

      // Cleanup stale entries
      await this.cleanupStaleEntries();

    } catch (error) {
      logger.error('Error in queue monitor:', error);
      MetricsService.trackError('job', 'queue_monitor_failed');
    }
  }

  private async monitorQueue(type: SessionType, size: number): Promise<void> {
    // Update metrics
    MetricsService.updateQueueSize(type, size);

    // Log warning if queue is getting large
    if (size > MONITORING.QUEUE_SIZE_THRESHOLD) {
      logger.warn(`Queue ${type} is large: ${size} users waiting`);
    }

    // Log debug info
    logger.debug(`Queue ${type}: ${size} users`);
  }

  private async checkQueueHealth(stats: any): Promise<void> {
    const { sizes, oldestTimes } = stats;

    // Check total queue size
    const totalSize = sizes.video + sizes.audio + sizes.text;
    
    if (totalSize === 0) {
      return; // No users in queue
    }

    // Check for users waiting too long
    for (const [type, info] of Object.entries(oldestTimes)) {
      if (info && typeof info === 'object' && 'waitTime' in info) {
        const waitTime = (info as any).waitTime;
        
        if (waitTime > 120) { // 2 minutes
          logger.warn(
            `User in ${type} queue waiting too long: ${waitTime}s`,
            { userId: (info as any).userId }
          );
        }
      }
    }

    // Alert if overall queue is very large
    if (totalSize > 1000) {
      logger.error(`ALERT: Total queue size critical: ${totalSize} users`);
      MetricsService.trackError('queue', 'critical_size');
    }
  }

  private async cleanupStaleEntries(): Promise<void> {
    try {
      const cleaned = await queueManager.cleanupStaleEntries();
      
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale queue entries`);
      }
    } catch (error) {
      logger.error('Error cleaning stale queue entries:', error);
    }
  }

  isJobRunning(): boolean {
    return this.isRunning;
  }

  async getQueueHealth(): Promise<any> {
    try {
      const stats = await queueManager.getQueueStats();
      
      if (!stats) {
        return { healthy: false, message: 'Failed to get queue stats' };
      }

      const { sizes } = stats;
      const totalSize = sizes.video + sizes.audio + sizes.text;

      // Determine health status
      const healthy = totalSize < MONITORING.QUEUE_SIZE_THRESHOLD;
      
      return {
        healthy,
        sizes,
        totalSize,
        threshold: MONITORING.QUEUE_SIZE_THRESHOLD,
        message: healthy ? 'Queues healthy' : 'Queues degraded',
      };
    } catch (error) {
      logger.error('Error getting queue health:', error);
      return { healthy: false, message: 'Error checking queue health' };
    }
  }
}

export default new QueueMonitorJob();