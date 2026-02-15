// src/services/matching/pairingEngine.ts
import queueManager, { IQueueUser } from './queueManager';
import sessionManager from './sessionManager';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';
import { RedisService, REDIS_CHANNELS } from '../../config/redis';

export interface IMatchResult {
  success: boolean;
  sessionId?: string;
  partner?: IQueueUser;
  error?: string;
}

export class PairingEngine {
  private matchingIntervals: Map<SessionType, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  // Start automatic matching for all queue types
  start(intervalMs: number = 2000): void {
    if (this.isRunning) {
      logger.warn('Pairing engine already running');
      return;
    }

    this.isRunning = true;

    // Start matching for each queue type
    for (const type of [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT]) {
      const interval = setInterval(() => {
        this.processQueue(type);
      }, intervalMs);

      this.matchingIntervals.set(type, interval);
    }

    logger.info('Pairing engine started');
  }

  // Stop automatic matching
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear all intervals
    for (const [type, interval] of this.matchingIntervals) {
      clearInterval(interval);
    }

    this.matchingIntervals.clear();
    logger.info('Pairing engine stopped');
  }

  // Process queue and create matches
  private async processQueue(queueType: SessionType): Promise<void> {
    try {
      const queueSize = await queueManager.getQueueSize(queueType);
      
      if (queueSize < 2) {
        return; // Not enough users to match
      }

      // Try to match users (process in batches)
      const matchCount = Math.floor(queueSize / 2);
      
      for (let i = 0; i < matchCount; i++) {
        // Get oldest two users and match them
        await this.matchOldestUsers(queueType);
      }
    } catch (error) {
      logger.error(`Error processing ${queueType} queue:`, error);
    }
  }

  // Match the two oldest users in queue
  private async matchOldestUsers(queueType: SessionType): Promise<void> {
    try {
      // This would typically be triggered by WebSocket handler
      // Here we just ensure the queue is being processed
      logger.debug(`Processing ${queueType} queue for matches`);
    } catch (error) {
      logger.error('Error matching oldest users:', error);
    }
  }

  // Attempt to match a specific user
  async matchUser(
    userId: string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      // Check if user is in queue
      const inQueue = await queueManager.isUserInQueue(userId);
      if (!inQueue.inQueue) {
        return {
          success: false,
          error: 'User not in queue',
        };
      }

      // Try to find a match
      const partner = await queueManager.findMatch(userId, queueType);

      if (!partner) {
        return {
          success: false,
          error: 'No match found',
        };
      }

      // Create session
      const session = await sessionManager.createSession(
        queueType,
        userId,
        partner.userId
      );

      if (!session) {
        // Re-add users to queue if session creation failed
        await queueManager.addToQueue(userId, '', queueType);
        await queueManager.addToQueue(partner.userId, partner.socketId, queueType);

        MetricsService.trackError('matching', 'session_creation_failed');

        return {
          success: false,
          error: 'Failed to create session',
        };
      }

      // Remove users from queue
      await queueManager.removeFromQueue(userId, queueType);
      await queueManager.removeFromQueue(partner.userId, queueType);

      // Publish match event
      await RedisService.publish(REDIS_CHANNELS.MATCH_FOUND, {
        sessionId: session.id,
        user1Id: userId,
        user2Id: partner.userId,
        sessionType: queueType,
      });

      // Update metrics
      MetricsService.trackQueueLeave(queueType, 'matched');

      logger.info(`Match created: ${userId} <-> ${partner.userId} (${queueType})`);

      return {
        success: true,
        sessionId: session.id,
        partner,
      };
    } catch (error) {
      logger.error('Error in matchUser:', error);
      MetricsService.trackError('matching', 'match_user_failed');

      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Quick match (instant matching attempt)
  async quickMatch(
    userId: string,
    socketId: string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      // Add to queue
      const added = await queueManager.addToQueue(userId, socketId, queueType);
      
      if (!added) {
        return {
          success: false,
          error: 'Failed to join queue',
        };
      }

      // Immediately try to find a match
      const result = await this.matchUser(userId, queueType);

      if (result.success) {
        return result;
      }

      // No immediate match found, user stays in queue
      return {
        success: false,
        error: 'Waiting for match',
      };
    } catch (error) {
      logger.error('Error in quickMatch:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Cancel matching (leave queue)
  async cancelMatching(userId: string, queueType: SessionType): Promise<boolean> {
    try {
      const removed = await queueManager.removeFromQueue(userId, queueType);
      
      if (removed) {
        MetricsService.trackQueueLeave(queueType, 'cancelled');
        logger.info(`User ${userId} cancelled matching in ${queueType}`);
      }

      return removed;
    } catch (error) {
      logger.error('Error cancelling matching:', error);
      return false;
    }
  }

  // Get matching status for user
  async getMatchingStatus(userId: string): Promise<{
    inQueue: boolean;
    queueType?: SessionType;
    position?: number;
    estimatedWaitTime?: number;
  }> {
    try {
      const inQueue = await queueManager.isUserInQueue(userId);

      if (!inQueue.inQueue || !inQueue.queueType) {
        return { inQueue: false };
      }

      const position = await queueManager.getQueuePosition(userId, inQueue.queueType);
      const queueSize = await queueManager.getQueueSize(inQueue.queueType);

      // Estimate wait time (very rough estimate)
      const estimatedWaitTime = Math.max(0, (position - 1) * 5); // 5 seconds per position

      return {
        inQueue: true,
        queueType: inQueue.queueType,
        position,
        estimatedWaitTime,
      };
    } catch (error) {
      logger.error('Error getting matching status:', error);
      return { inQueue: false };
    }
  }

  // Match with specific user (friend matching)
  async matchWithFriend(
    userId: string,
    friendId: string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      // Check if both users are available (not in active session)
      const userSession = await sessionManager.getActiveSession(userId);
      const friendSession = await sessionManager.getActiveSession(friendId);

      if (userSession || friendSession) {
        return {
          success: false,
          error: 'One or both users are already in a session',
        };
      }

      // Create session directly
      const session = await sessionManager.createSession(
        queueType,
        userId,
        friendId
      );

      if (!session) {
        return {
          success: false,
          error: 'Failed to create session',
        };
      }

      logger.info(`Friend match created: ${userId} <-> ${friendId} (${queueType})`);

      return {
        success: true,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Error matching with friend:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Get pairing statistics
  async getStats(): Promise<any> {
    try {
      const queueStats = await queueManager.getQueueStats();
      
      return {
        queues: queueStats,
        isRunning: this.isRunning,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting pairing stats:', error);
      return null;
    }
  }

  // Force match two specific users (admin/testing)
  async forceMatch(
    user1Id: string,
    user2Id: string,
    queueType: SessionType
  ): Promise<IMatchResult> {
    try {
      // Remove from queues if present
      await queueManager.removeFromAllQueues(user1Id);
      await queueManager.removeFromAllQueues(user2Id);

      // Create session
      const session = await sessionManager.createSession(
        queueType,
        user1Id,
        user2Id
      );

      if (!session) {
        return {
          success: false,
          error: 'Failed to create session',
        };
      }

      logger.info(`Force match: ${user1Id} <-> ${user2Id} (${queueType})`);

      return {
        success: true,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Error in force match:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Rematch (find new partner after ending current session)
  async rematch(userId: string, queueType: SessionType): Promise<IMatchResult> {
    try {
      // End current session if exists
      const currentSession = await sessionManager.getActiveSession(userId);
      if (currentSession) {
        await sessionManager.endSession(currentSession.id);
      }

      // Remove from any queues
      await queueManager.removeFromAllQueues(userId);

      // Quick match with new partner
      return await this.quickMatch(userId, '', queueType);
    } catch (error) {
      logger.error('Error in rematch:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }
}

export default new PairingEngine();