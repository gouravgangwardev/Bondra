// ============================================
// FILE 1: tests/unit/services/authService.test.ts
// ============================================
import { AuthService } from '../../../src/services/auth/authService';
import { User } from '../../../src/models/User';

jest.mock('../../../src/models/User');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'test-uuid',
        username: 'testuser',
        email: 'test@example.com',
        is_guest: false,
      };

      (User.usernameExists as jest.Mock).mockResolvedValue(false);
      (User.emailExists as jest.Mock).mockResolvedValue(false);
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.register('testuser', 'test@example.com', 'Password123');

      expect(result).toBeDefined();
      expect(result?.user.username).toBe('testuser');
      expect(result?.accessToken).toBeDefined();
    });

    it('should fail if username already exists', async () => {
      (User.usernameExists as jest.Mock).mockResolvedValue(true);

      const result = await AuthService.register('testuser', 'test@example.com', 'Password123');

      expect(result).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = AuthService.validatePassword('Password123');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result = AuthService.validatePassword('weak');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateUsername', () => {
    it('should validate correct username', () => {
      const result = AuthService.validateUsername('john_doe');
      
      expect(result.valid).toBe(true);
    });

    it('should reject short username', () => {
      const result = AuthService.validateUsername('ab');
      
      expect(result.valid).toBe(false);
    });
  });
});
