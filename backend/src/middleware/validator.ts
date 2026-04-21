// ============================================
// FILE 5: src/middleware/validator.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_CODES, VALIDATION_RULES } from '../config/constants';

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

// Validate username
export const validateUsername = (username: string): string[] => {
  const errors: string[] = [];

  if (!username) {
    errors.push('Username is required');
    return errors;
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

  return errors;
};

// Validate email
export const validateEmail = (email: string): string[] => {
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
    return errors;
  }

  if (!VALIDATION_RULES.EMAIL.PATTERN.test(email)) {
    errors.push('Invalid email format');
  }

  return errors;
};

// Validate password
export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return errors;
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

  return errors;
};

// Validate UUID
export const validateUUID = (uuid: string): boolean => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
};

// Request validation middleware
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body fields based on schema
    if (schema.username && req.body.username) {
      errors.push(...validateUsername(req.body.username));
    }

    if (schema.email && req.body.email) {
      errors.push(...validateEmail(req.body.email));
    }

    if (schema.password && req.body.password) {
      errors.push(...validatePassword(req.body.password));
    }

    // Validate UUID params
    if (schema.userId && req.params.userId) {
      if (!validateUUID(req.params.userId)) {
        errors.push('Invalid user ID format');
      }
    }

    if (errors.length > 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    next();
  };
};

// Sanitize input
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .substring(0, 1000); // Limit length
};

// Sanitize request body
export const sanitizeRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  next();
};