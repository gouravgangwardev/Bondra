// ============================================
// FILE 1: src/utils/validator.ts
// ============================================
import { VALIDATION_RULES } from '../config/constants';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validator {
  // Validate username
  static validateUsername(username: string): ValidationResult {
    const errors: string[] = [];

    if (!username || typeof username !== 'string') {
      errors.push('Username is required');
      return { valid: false, errors };
    }

    if (username.length < VALIDATION_RULES.USERNAME.MIN_LENGTH) {
      errors.push(`Username must be at least ${VALIDATION_RULES.USERNAME.MIN_LENGTH} characters`);
    }

    if (username.length > VALIDATION_RULES.USERNAME.MAX_LENGTH) {
      errors.push(`Username must be no more than ${VALIDATION_RULES.USERNAME.MAX_LENGTH} characters`);
    }

    if (!VALIDATION_RULES.USERNAME.PATTERN.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate email
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
      return { valid: false, errors };
    }

    if (!VALIDATION_RULES.EMAIL.PATTERN.test(email)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate password
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { valid: false, errors };
    }

    if (password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters`);
    }

    if (password.length > VALIDATION_RULES.PASSWORD.MAX_LENGTH) {
      errors.push(`Password must be no more than ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`);
    }

    if (VALIDATION_RULES.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (VALIDATION_RULES.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (VALIDATION_RULES.PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (VALIDATION_RULES.PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate UUID
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Validate message content
  static validateMessage(message: string): ValidationResult {
    const errors: string[] = [];

    if (!message || typeof message !== 'string') {
      errors.push('Message is required');
      return { valid: false, errors };
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      errors.push('Message cannot be empty');
    }

    if (trimmed.length > VALIDATION_RULES.MESSAGE.MAX_LENGTH) {
      errors.push(`Message must be no more than ${VALIDATION_RULES.MESSAGE.MAX_LENGTH} characters`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate report reason
  static validateReportReason(reason: string): ValidationResult {
    const errors: string[] = [];

    if (!reason || typeof reason !== 'string') {
      errors.push('Report reason is required');
      return { valid: false, errors };
    }

    const validReasons = [
      'inappropriate_content',
      'harassment',
      'spam',
      'underage',
      'violence',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      errors.push('Invalid report reason');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate report description
  static validateReportDescription(description: string): ValidationResult {
    const errors: string[] = [];

    if (description && description.length > VALIDATION_RULES.REPORT_REASON.MAX_LENGTH) {
      errors.push(`Description must be no more than ${VALIDATION_RULES.REPORT_REASON.MAX_LENGTH} characters`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Sanitize string (remove HTML, trim whitespace)
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  // Validate and sanitize URL
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // Validate pagination parameters
  static validatePagination(page?: number, limit?: number) {
    const p = Math.max(1, parseInt(String(page || 1)));
    const l = Math.min(100, Math.max(1, parseInt(String(limit || 20))));
    
    return { page: p, limit: l };
  }

  // Check if string contains profanity (basic example)
  static containsProfanity(text: string): boolean {
    const profanityList = ['badword1', 'badword2']; // Add actual list
    const lowerText = text.toLowerCase();
    return profanityList.some(word => lowerText.includes(word));
  }
}

export default Validator;