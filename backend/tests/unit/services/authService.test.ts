// tests/unit/services/authService.test.ts

import { AuthService } from '../../../src/services/auth/authService';
import { User } from '../../../src/models/User';

jest.mock('../../../src/models/User');
jest.mock('../../../src/config/redis', () => ({
  redisClient: {
    set:    jest.fn().mockResolvedValue('OK'),
    get:    jest.fn().mockResolvedValue(null),
    del:    jest.fn().mockResolvedValue(1),
    setex:  jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
  },
  REDIS_KEYS: {},
}));
jest.mock('../../../src/config/monitoring', () => ({
  MetricsService: {
    trackError:  jest.fn(),
    usersTotal:  { labels: jest.fn(() => ({ inc: jest.fn() })) },
    logins:      { labels: jest.fn(() => ({ inc: jest.fn() })) },
  },
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('registers a new user successfully', async () => {
      const mockUser = { id: 'u-1', username: 'testuser', email: 'test@example.com', is_guest: false };
      (User.usernameExists as jest.Mock).mockResolvedValue(false);
      (User.emailExists    as jest.Mock).mockResolvedValue(false);
      (User.create         as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.register('testuser', 'test@example.com', 'Password123!');
      expect(result).not.toBeNull();
      expect(result!.user.username).toBe('testuser');
      expect(result!.accessToken).toBeDefined();
      expect(result!.refreshToken).toBeDefined();
    });

    it('fails if username already exists', async () => {
      (User.usernameExists as jest.Mock).mockResolvedValue(true);
      const result = await AuthService.register('taken', 'x@x.com', 'Password123!');
      expect(result).toBeNull();
    });

    it('fails if email already exists', async () => {
      (User.usernameExists as jest.Mock).mockResolvedValue(false);
      (User.emailExists    as jest.Mock).mockResolvedValue(true);
      const result = await AuthService.register('newuser', 'taken@example.com', 'Password123!');
      expect(result).toBeNull();
    });
  });

  // ── validatePassword ───────────────────────────────────────────────────────

  describe('validatePassword', () => {
    it('accepts a strong password', () => {
      const result = AuthService.validatePassword('StrongPass1!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a password that is too short', () => {
      const result = AuthService.validatePassword('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => /length|short|characters/i.test(e))).toBe(true);
    });

    it('rejects a password with no uppercase letter', () => {
      const result = AuthService.validatePassword('password123!');
      expect(result.valid).toBe(false);
    });

    it('rejects a password with no number', () => {
      const result = AuthService.validatePassword('PasswordOnly!');
      expect(result.valid).toBe(false);
    });
  });

  // ── validateUsername ───────────────────────────────────────────────────────

  describe('validateUsername', () => {
    it('accepts a valid username', () => {
      const result = AuthService.validateUsername('john_doe');
      expect(result.valid).toBe(true);
    });

    it('rejects a username that is too short', () => {
      const result = AuthService.validateUsername('ab');
      expect(result.valid).toBe(false);
    });

    it('rejects a username with invalid characters', () => {
      const result = AuthService.validateUsername('john@doe');
      expect(result.valid).toBe(false);
    });
  });
});
