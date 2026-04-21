// src/services/auth/authService.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User, IUser } from '../../models/User';
import { ENV } from '../../config/environment';
import { logger } from '../../utils/logger';
import { ERROR_CODES } from '../../config/constants';

export interface ILoginResponse {
  user: Partial<IUser>;
  accessToken: string;
  refreshToken: string;
}

export interface ITokenPayload {
  userId: string;
  username: string;
  isGuest: boolean;
}

export class AuthService {
  // Register new user
  static async register(
    username: string,
    email: string,
    password: string
  ): Promise<ILoginResponse | null> {
    try {
      // Check if username exists
      const usernameExists = await User.usernameExists(username);
      if (usernameExists) {
        logger.warn(`Registration failed: Username ${username} already exists`);
        return null;
      }

      // Check if email exists
      if (email) {
        const emailExists = await User.emailExists(email);
        if (emailExists) {
          logger.warn(`Registration failed: Email ${email} already exists`);
          return null;
        }
      }

      // Create user
      const user = await User.create({
        username,
        email,
        password,
        is_guest: false,
      });

      if (!user) {
        logger.error('Failed to create user');
        return null;
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.info(`User registered successfully: ${username}`);

      return {
        user: this.sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      logger.error('Error in register service:', error);
      return null;
    }
  }

  // Login user
  static async login(
    usernameOrEmail: string,
    password: string
  ): Promise<ILoginResponse | null> {
    try {
      // Find user by username or email
      let user = await User.findByUsername(usernameOrEmail);
      
      if (!user) {
        user = await User.findByEmail(usernameOrEmail);
      }

      if (!user) {
        logger.warn(`Login failed: User not found - ${usernameOrEmail}`);
        return null;
      }

      // Check if user is banned
      if (user.is_banned) {
        logger.warn(`Login failed: User banned - ${usernameOrEmail}`);
        return null;
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(user, password);
      if (!isValidPassword) {
        logger.warn(`Login failed: Invalid password - ${usernameOrEmail}`);
        return null;
      }

      // Update last seen
      await User.updateLastSeen(user.id);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.info(`User logged in successfully: ${user.username}`);

      return {
        user: this.sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      logger.error('Error in login service:', error);
      return null;
    }
  }

  // Create guest user
  static async createGuest(): Promise<ILoginResponse | null> {
    try {
      const guestUser = await User.createGuest();

      if (!guestUser) {
        logger.error('Failed to create guest user');
        return null;
      }

      // Generate tokens
      const tokens = await this.generateTokens(guestUser);

      logger.info(`Guest user created: ${guestUser.username}`);

      return {
        user: this.sanitizeUser(guestUser),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      logger.error('Error creating guest user:', error);
      return null;
    }
  }

  // Refresh access token
  static async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      // Verify refresh token
      const payload = jwt.verify(
        refreshToken,
        ENV.JWT_REFRESH_SECRET
      ) as ITokenPayload;

      // Get user
      const user = await User.findById(payload.userId);
      if (!user || user.is_banned) {
        return null;
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return accessToken;
    } catch (error) {
      logger.error('Error refreshing token:', error);
      return null;
    }
  }

  // Verify access token
  static async verifyAccessToken(token: string): Promise<ITokenPayload | null> {
    try {
      const payload = jwt.verify(token, ENV.JWT_SECRET) as ITokenPayload;
      return payload;
    } catch (error) {
      logger.debug('Token verification failed:', error);
      return null;
    }
  }

  // Generate access and refresh tokens
  private static async generateTokens(user: IUser): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  // Generate access token
  private static generateAccessToken(user: IUser): string {
    const payload: ITokenPayload = {
      userId: user.id,
      username: user.username,
      isGuest: user.is_guest,
    };

    return jwt.sign(payload, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });
  }

  // Generate refresh token
  private static generateRefreshToken(user: IUser): string {
    const payload: ITokenPayload = {
      userId: user.id,
      username: user.username,
      isGuest: user.is_guest,
    };

    return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
      expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
    });
  }

  // Remove sensitive data from user object
  private static sanitizeUser(user: IUser): Partial<IUser> {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  // Validate password strength
  static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate username
  static validateUsername(username: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 20) {
      errors.push('Username must be no more than 20 characters long');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate email
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Change password
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      // Verify old password
      const isValidPassword = await User.verifyPassword(user, oldPassword);
      if (!isValidPassword) {
        return false;
      }

      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        return false;
      }

      // Hash new password
      const password_hash = await bcrypt.hash(newPassword, ENV.BCRYPT_ROUNDS);

      // Update password (using raw query since we need to update password_hash)
      const { query } = await import('../../config/database');
      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [password_hash, userId]
      );

      logger.info(`Password changed for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error changing password:', error);
      return false;
    }
  }

  // Logout (optional - for token blacklisting in future)
  static async logout(userId: string): Promise<boolean> {
    try {
      // Update last seen
      await User.updateLastSeen(userId);
      
      // In future, you can add token blacklisting here
      // For now, just log the action
      logger.info(`User logged out: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error in logout:', error);
      return false;
    }
  }
}

export default AuthService;
