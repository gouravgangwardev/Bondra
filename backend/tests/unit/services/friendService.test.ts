// tests/unit/services/friendService.test.ts

import { FriendService } from '../../../src/services/friends/friendService';
import { FriendshipStatus } from '../../../src/config/constants';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockFriendship = {
  findFriendship:         jest.fn(),
  sendRequest:            jest.fn(),
  acceptRequest:          jest.fn(),
  rejectRequest:          jest.fn(),
  blockUser:              jest.fn(),
  getFriendList:          jest.fn().mockResolvedValue([]),
  getPendingRequests:     jest.fn().mockResolvedValue([]),
  areFriends:             jest.fn().mockResolvedValue(false),
  isFriendshipBlocked:    jest.fn().mockResolvedValue(false),
  deleteFriendship:       jest.fn().mockResolvedValue(true),
  getBlockedUsers:        jest.fn().mockResolvedValue([]),
};
jest.mock('../../../src/models/Friendship', () => ({ Friendship: mockFriendship }));

const mockUser = {
  findById: jest.fn(),
};
jest.mock('../../../src/models/User', () => ({ User: mockUser }));

jest.mock('../../../src/config/redis', () => ({
  RedisService: {
    setCache:    jest.fn(),
    getCache:    jest.fn().mockResolvedValue(null),
    deleteCache: jest.fn(),
  },
  REDIS_KEYS: { FRIEND_LIST: 'friend:list:', FRIEND_REQUESTS: 'friend:requests:' },
}));

jest.mock('../../../src/config/monitoring', () => ({
  MetricsService: { friendRequestsTotal: { labels: jest.fn(() => ({ inc: jest.fn() })) } },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('FriendService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── sendFriendRequest ──────────────────────────────────────────────────────

  describe('sendFriendRequest', () => {
    it('sends a friend request successfully', async () => {
      mockUser.findById.mockResolvedValue({ id: 'user-2', username: 'alice' });
      mockFriendship.findFriendship.mockResolvedValue(null);
      mockFriendship.sendRequest.mockResolvedValue({ id: 'fr-1', status: FriendshipStatus.PENDING });

      const result = await FriendService.sendFriendRequest('user-1', 'user-2');
      expect(result.success).toBe(true);
    });

    it('rejects self-friending', async () => {
      const result = await FriendService.sendFriendRequest('user-1', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/yourself/i);
    });

    it('rejects request to non-existent user', async () => {
      mockUser.findById.mockResolvedValue(null);
      const result = await FriendService.sendFriendRequest('user-1', 'ghost');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('rejects duplicate friend request', async () => {
      mockUser.findById.mockResolvedValue({ id: 'user-2' });
      mockFriendship.findFriendship.mockResolvedValue({
        status: FriendshipStatus.PENDING,
      });

      const result = await FriendService.sendFriendRequest('user-1', 'user-2');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already sent/i);
    });

    it('rejects request to already-friends user', async () => {
      mockUser.findById.mockResolvedValue({ id: 'user-2' });
      mockFriendship.findFriendship.mockResolvedValue({
        status: FriendshipStatus.ACCEPTED,
      });

      const result = await FriendService.sendFriendRequest('user-1', 'user-2');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already friends/i);
    });

    it('rejects request when user is blocked', async () => {
      mockUser.findById.mockResolvedValue({ id: 'user-2' });
      mockFriendship.findFriendship.mockResolvedValue({
        status: FriendshipStatus.BLOCKED,
      });

      const result = await FriendService.sendFriendRequest('user-1', 'user-2');
      expect(result.success).toBe(false);
    });
  });

  // ── areFriends ─────────────────────────────────────────────────────────────

  describe('areFriends', () => {
    it('returns true when users are friends', async () => {
      mockFriendship.findFriendship.mockResolvedValue({
        status: FriendshipStatus.ACCEPTED,
      });
      const result = await FriendService.areFriends('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('returns false when users are not friends', async () => {
      mockFriendship.findFriendship.mockResolvedValue(null);
      const result = await FriendService.areFriends('user-1', 'user-2');
      expect(result).toBe(false);
    });

    it('returns false when friendship is only pending', async () => {
      mockFriendship.findFriendship.mockResolvedValue({
        status: FriendshipStatus.PENDING,
      });
      const result = await FriendService.areFriends('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });
});
