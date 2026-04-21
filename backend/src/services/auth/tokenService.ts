// src/services/auth/tokenService.ts
import jwt from 'jsonwebtoken';
import { redisClient } from '../../config/redis';
import { ENV } from '../../config/environment';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

export interface ITokenPayload {
  userId: string;
  username: string;
  isGuest: boolean;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface IDecodedToken extends ITokenPayload {
  iat: number;
  exp: number;
}

export class TokenService {
  private readonly TOKEN_PREFIX = 'token:';
  private readonly BLACKLIST_PREFIX = 'token:blacklist:';
  private readonly REFRESH_PREFIX = 'token:refresh:';
  private readonly TOKEN_FAMILY_PREFIX = 'token:family:';

  // Generate access token
  generateAccessToken(userId: string, username: string, isGuest: boolean): string {
    try {
      const payload: ITokenPayload = {
        userId,
        username,
        isGuest,
        type: 'access',
      };

      const token = jwt.sign(payload, ENV.JWT_SECRET, {
        expiresIn: ENV.JWT_EXPIRES_IN,
      });

      logger.debug(`Access token generated for user: ${userId}`);
      return token;
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw error;
    }
  }

  // Generate refresh token
  generateRefreshToken(userId: string, username: string, isGuest: boolean): string {
    try {
      const payload: ITokenPayload = {
        userId,
        username,
        isGuest,
        type: 'refresh',
      };

      const token = jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
        expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
      });

      logger.debug(`Refresh token generated for user: ${userId}`);
      return token;
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw error;
    }
  }

  // Generate token pair
  generateTokenPair(userId: string, username: string, isGuest: boolean): ITokenPair {
    const accessToken = this.generateAccessToken(userId, username, isGuest);
    const refreshToken = this.generateRefreshToken(userId, username, isGuest);

    return { accessToken, refreshToken };
  }

  // Verify access token
  verifyAccessToken(token: string): IDecodedToken | null {
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as IDecodedToken;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid access token');
      } else {
        logger.error('Error verifying access token:', error);
      }
      return null;
    }
  }

  // Verify refresh token
  verifyRefreshToken(token: string): IDecodedToken | null {
    try {
      const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET) as IDecodedToken;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid refresh token');
      } else {
        logger.error('Error verifying refresh token:', error);
      }
      return null;
    }
  }

  // Decode token without verification (for inspection)
  decodeToken(token: string): IDecodedToken | null {
    try {
      const decoded = jwt.decode(token) as IDecodedToken;
      return decoded;
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  // Blacklist token (for logout)
  async blacklistToken(token: string): Promise<boolean> {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded) {
        return false;
      }

      // Calculate TTL (time until token expires)
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl > 0) {
        // Store in blacklist with expiry
        await redisClient.setex(
          `${this.BLACKLIST_PREFIX}${token}`,
          ttl,
          'blacklisted'
        );

        logger.info(`Token blacklisted for user: ${decoded.userId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      return false;
    }
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const exists = await redisClient.exists(`${this.BLACKLIST_PREFIX}${token}`);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      return false;
    }
  }

  // Store refresh token with user association
  async storeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    try {
      const decoded = this.decodeToken(refreshToken);
      if (!decoded) {
        return false;
      }

      // Calculate TTL
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl > 0) {
        // Generate token family ID for refresh token rotation
        const familyId = crypto.randomBytes(16).toString('hex');
        
        // Store refresh token
        await redisClient.setex(
          `${this.REFRESH_PREFIX}${userId}`,
          ttl,
          refreshToken
        );

        // Store token family for rotation detection
        await redisClient.setex(
          `${this.TOKEN_FAMILY_PREFIX}${familyId}`,
          ttl,
          JSON.stringify({ userId, refreshToken })
        );

        logger.debug(`Refresh token stored for user: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      return false;
    }
  }

  // Get stored refresh token
  async getStoredRefreshToken(userId: string): Promise<string | null> {
    try {
      return await redisClient.get(`${this.REFRESH_PREFIX}${userId}`);
    } catch (error) {
      logger.error('Error getting stored refresh token:', error);
      return null;
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(userId: string): Promise<boolean> {
    try {
      const deleted = await redisClient.del(`${this.REFRESH_PREFIX}${userId}`);
      
      if (deleted > 0) {
        logger.info(`Refresh token revoked for user: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      return false;
    }
  }

  // Revoke all tokens for user
  async revokeAllUserTokens(userId: string): Promise<boolean> {
    try {
      // Revoke refresh token
      await this.revokeRefreshToken(userId);

      // In a production system, you would also blacklist all active access tokens
      // This requires storing active tokens or using a shorter expiry time

      logger.info(`All tokens revoked for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error revoking all user tokens:', error);
      return false;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return null;
      }

      // Check if refresh token is stored (for rotation detection)
      const storedToken = await this.getStoredRefreshToken(decoded.userId);
      
      if (!storedToken || storedToken !== refreshToken) {
        logger.warn(`Refresh token mismatch or reuse detected for user: ${decoded.userId}`);
        // Revoke all tokens on suspicious activity
        await this.revokeAllUserTokens(decoded.userId);
        return null;
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(
        decoded.userId,
        decoded.username,
        decoded.isGuest
      );

      logger.debug(`Access token refreshed for user: ${decoded.userId}`);
      return newAccessToken;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      return null;
    }
  }

  // Rotate refresh token (generate new refresh token and invalidate old one)
  async rotateRefreshToken(oldRefreshToken: string): Promise<ITokenPair | null> {
    try {
      // Verify old refresh token
      const decoded = this.verifyRefreshToken(oldRefreshToken);
      if (!decoded) {
        return null;
      }

      // Generate new token pair
      const newTokens = this.generateTokenPair(
        decoded.userId,
        decoded.username,
        decoded.isGuest
      );

      // Store new refresh token
      await this.storeRefreshToken(decoded.userId, newTokens.refreshToken);

      // Blacklist old refresh token
      await this.blacklistToken(oldRefreshToken);

      logger.info(`Refresh token rotated for user: ${decoded.userId}`);
      return newTokens;
    } catch (error) {
      logger.error('Error rotating refresh token:', error);
      return null;
    }
  }

  // Validate token and check blacklist
  async validateToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<IDecodedToken | null> {
    try {
      // Check blacklist first
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        logger.debug('Token is blacklisted');
        return null;
      }

      // Verify token using the correct secret for the expected type
      const decoded = type === 'access'
        ? this.verifyAccessToken(token)
        : this.verifyRefreshToken(token);

      // Bug 9 fix: even if the signature is valid, reject the token when its
      // embedded `type` claim doesn't match what the caller expects.
      // Without this check a refresh token (signed with the same secret as the
      // access token) could be accepted wherever an access token is required.
      if (decoded && decoded.type && decoded.type !== type) {
        logger.debug(`Token type mismatch: expected '${type}', got '${decoded.type}'`);
        return null;
      }

      return decoded;
    } catch (error) {
      logger.error('Error validating token:', error);
      return null;
    }
  }

  // Get token expiry time
  getTokenExpiry(token: string): number | null {
    try {
      const decoded = this.decodeToken(token);
      return decoded?.exp || null;
    } catch (error) {
      logger.error('Error getting token expiry:', error);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    try {
      const expiry = this.getTokenExpiry(token);
      if (!expiry) return true;

      const now = Math.floor(Date.now() / 1000);
      return now >= expiry;
    } catch (error) {
      logger.error('Error checking token expiry:', error);
      return true;
    }
  }

  // Get time until token expires (in seconds)
  getTimeUntilExpiry(token: string): number | null {
    try {
      const expiry = this.getTokenExpiry(token);
      if (!expiry) return null;

      const now = Math.floor(Date.now() / 1000);
      const timeLeft = expiry - now;
      
      return timeLeft > 0 ? timeLeft : 0;
    } catch (error) {
      logger.error('Error getting time until expiry:', error);
      return null;
    }
  }

  // Clean up expired blacklisted tokens (Redis handles this automatically with TTL)
  async cleanupExpiredBlacklist(): Promise<number> {
    try {
      // Redis automatically removes expired keys, but we can manually scan and clean if needed
      let cursor = '0';
      let cleaned = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          `${this.BLACKLIST_PREFIX}*`,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const token = key.replace(this.BLACKLIST_PREFIX, '');
          if (this.isTokenExpired(token)) {
            await redisClient.del(key);
            cleaned++;
          }
        }
      } while (cursor !== '0');

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired blacklisted tokens`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up expired blacklist:', error);
      return 0;
    }
  }

  // Get token statistics
  async getTokenStats(): Promise<any> {
    try {
      let blacklistedCount = 0;
      let refreshTokenCount = 0;
      let cursor = '0';

      // Count blacklisted tokens
      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          `${this.BLACKLIST_PREFIX}*`,
          'COUNT',
          100
        );
        cursor = newCursor;
        blacklistedCount += keys.length;
      } while (cursor !== '0');

      // Count refresh tokens
      cursor = '0';
      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          `${this.REFRESH_PREFIX}*`,
          'COUNT',
          100
        );
        cursor = newCursor;
        refreshTokenCount += keys.length;
      } while (cursor !== '0');

      return {
        blacklistedTokens: blacklistedCount,
        activeRefreshTokens: refreshTokenCount,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting token stats:', error);
      return null;
    }
  }
}

export default new TokenService();