// ============================================
// FILE 2: tests/unit/services/queueManager.test.ts
// ============================================
import queueManager from '../../../src/services/matching/queueManager';
import { SessionType } from '../../../src/config/constants';

describe('QueueManager', () => {
  beforeEach(async () => {
    // Clear queues before each test
    await queueManager.clearAllQueues();
  });

  describe('addToQueue', () => {
    it('should add user to queue', async () => {
      const result = await queueManager.addToQueue(
        'user-1',
        'socket-1',
        SessionType.VIDEO
      );

      expect(result).toBe(true);

      const queueSize = await queueManager.getQueueSize(SessionType.VIDEO);
      expect(queueSize).toBe(1);
    });

    it('should not add same user twice', async () => {
      await queueManager.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      const result = await queueManager.addToQueue('user-1', 'socket-1', SessionType.VIDEO);

      expect(result).toBe(false);
    });
  });

  describe('findMatch', () => {
    it('should match two users in queue', async () => {
      await queueManager.addToQueue('user-1', 'socket-1', SessionType.VIDEO);
      await queueManager.addToQueue('user-2', 'socket-2', SessionType.VIDEO);

      const match = await queueManager.findMatch('user-1', SessionType.VIDEO);

      expect(match).toBeDefined();
      expect(match?.userId).toBe('user-2');
    });

    it('should return null if not enough users', async () => {
      await queueManager.addToQueue('user-1', 'socket-1', SessionType.VIDEO);

      const match = await queueManager.findMatch('user-1', SessionType.VIDEO);

      expect(match).toBeNull();
    });
  });
});
