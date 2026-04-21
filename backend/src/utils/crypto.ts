// ============================================
// FILE 2: src/utils/crypto.ts
// ============================================
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ENV } from '../config/environment';

export class CryptoUtils {
  // Hash password using bcrypt
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, ENV.BCRYPT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate random token
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate random UUID
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  // Generate random numeric code
  static generateNumericCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  // Hash string using SHA256
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Create HMAC
  static createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Verify HMAC
  static verifyHMAC(data: string, secret: string, signature: string): boolean {
    const expected = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  }

  // Encrypt data (AES-256-GCM)
  static encrypt(data: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decrypt data
  static decrypt(encryptedData: string, key: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Generate secure random string
  static generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  // Generate password reset token
  static generateResetToken(): { token: string; hash: string } {
    const token = this.generateToken(32);
    const hash = this.hash(token);
    return { token, hash };
  }

  // Mask sensitive data (for logging)
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (!domain) return '***';
    
    const maskedUsername = username.substring(0, 2) + '***';
    return `${maskedUsername}@${domain}`;
  }

  static maskPassword(): string {
    return '********';
  }

  static maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return token.substring(0, 4) + '...' + token.substring(token.length - 4);
  }
}

export default CryptoUtils;
