// src/config/environment.ts
import Joi from 'joi';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment variable schema with validation
const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .default(3000),
  
  HOST: Joi.string()
    .default('0.0.0.0'),
  
  // Database
  DB_HOST: Joi.string()
    .required()
    .description('PostgreSQL host'),
  
  DB_PORT: Joi.number()
    .default(5432),
  
  DB_NAME: Joi.string()
    .required()
    .description('PostgreSQL database name'),
  
  DB_USER: Joi.string()
    .required()
    .description('PostgreSQL username'),
  
  DB_PASSWORD: Joi.string()
    .required()
    .description('PostgreSQL password'),
  
  // Redis
  REDIS_HOST: Joi.string()
    .required()
    .description('Redis host'),
  
  REDIS_PORT: Joi.number()
    .default(6379),
  
  REDIS_PASSWORD: Joi.string()
    .optional()
    .allow('')
    .description('Redis password'),
  
  // JWT
  JWT_SECRET: Joi.string()
    .required()
    .min(32)
    .description('JWT secret key (min 32 chars)'),
  
  JWT_EXPIRES_IN: Joi.string()
    .default('7d')
    .description('JWT expiration time'),
  
  JWT_REFRESH_SECRET: Joi.string()
    .required()
    .min(32)
    .description('JWT refresh token secret'),
  
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .default('30d'),
  
  // CORS
  CORS_ORIGIN: Joi.string()
    .default('*')
    .description('CORS allowed origins (comma-separated)'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .default(900000)
    .description('Rate limit window in ms (default: 15 min)'),
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .default(100)
    .description('Max requests per window'),
  
  // WebSocket
  WS_PING_TIMEOUT: Joi.number()
    .default(60000)
    .description('WebSocket ping timeout in ms'),
  
  WS_PING_INTERVAL: Joi.number()
    .default(25000)
    .description('WebSocket ping interval in ms'),
  
  WS_MAX_BUFFER_SIZE: Joi.number()
    .default(1000000)
    .description('Max WebSocket message size in bytes'),
  
  // Session
  SESSION_TIMEOUT: Joi.number()
    .default(3600000)
    .description('Session timeout in ms (default: 1 hour)'),
  
  SESSION_CLEANUP_INTERVAL: Joi.number()
    .default(300000)
    .description('Session cleanup interval in ms (default: 5 min)'),
  
  // Queue
  QUEUE_MATCH_TIMEOUT: Joi.number()
    .default(30000)
    .description('Queue matching timeout in ms'),
  
  QUEUE_CLEANUP_INTERVAL: Joi.number()
    .default(60000)
    .description('Queue cleanup interval in ms'),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'debug')
    .default('info'),
  
  LOG_FILE_PATH: Joi.string()
    .default('./logs')
    .description('Log file directory'),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean()
    .default(true)
    .description('Enable Prometheus metrics'),
  
  METRICS_PORT: Joi.number()
    .default(9090)
    .description('Prometheus metrics port'),
  
  // Security
  BCRYPT_ROUNDS: Joi.number()
    .default(12)
    .min(10)
    .max(15)
    .description('Bcrypt hashing rounds'),
  
  ENABLE_HELMET: Joi.boolean()
    .default(true)
    .description('Enable Helmet.js security headers'),
  
  // File Upload (Future)
  MAX_FILE_SIZE: Joi.number()
    .default(5242880)
    .description('Max file upload size in bytes (default: 5MB)'),
  
  // Feature Flags
  ENABLE_FRIEND_SYSTEM: Joi.boolean()
    .default(true),
  
  ENABLE_REPORTING: Joi.boolean()
    .default(true),
  
  // External Services (Future)
  TURN_SERVER_URL: Joi.string()
    .optional()
    .description('TURN server URL for WebRTC NAT traversal'),
  
  TURN_SERVER_USERNAME: Joi.string()
    .optional(),
  
  TURN_SERVER_CREDENTIAL: Joi.string()
    .optional(),
  
  // Email (Future - for notifications)
  SMTP_HOST: Joi.string()
    .optional(),
  
  SMTP_PORT: Joi.number()
    .optional(),
  
  SMTP_USER: Joi.string()
    .optional(),
  
  SMTP_PASS: Joi.string()
    .optional(),
  
  // Sentry (Error tracking)
  SENTRY_DSN: Joi.string()
    .optional()
    .description('Sentry DSN for error tracking'),
  
}).unknown(true);

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export validated and typed environment variables
export const ENV = {
  // Application
  NODE_ENV: envVars.NODE_ENV as 'development' | 'production' | 'test',
  PORT: envVars.PORT as number,
  HOST: envVars.HOST as string,
  IS_PRODUCTION: envVars.NODE_ENV === 'production',
  IS_DEVELOPMENT: envVars.NODE_ENV === 'development',
  IS_TEST: envVars.NODE_ENV === 'test',
  
  // Database
  DB_HOST: envVars.DB_HOST as string,
  DB_PORT: envVars.DB_PORT as number,
  DB_NAME: envVars.DB_NAME as string,
  DB_USER: envVars.DB_USER as string,
  DB_PASSWORD: envVars.DB_PASSWORD as string,
  
  // Redis
  REDIS_HOST: envVars.REDIS_HOST as string,
  REDIS_PORT: envVars.REDIS_PORT as number,
  REDIS_PASSWORD: envVars.REDIS_PASSWORD as string | undefined,
  
  // JWT
  JWT_SECRET: envVars.JWT_SECRET as string,
  JWT_EXPIRES_IN: envVars.JWT_EXPIRES_IN as string,
  JWT_REFRESH_SECRET: envVars.JWT_REFRESH_SECRET as string,
  JWT_REFRESH_EXPIRES_IN: envVars.JWT_REFRESH_EXPIRES_IN as string,
  
  // CORS
  CORS_ORIGIN: envVars.CORS_ORIGIN as string,
  CORS_ORIGINS: (envVars.CORS_ORIGIN as string).split(',').map(o => o.trim()),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: envVars.RATE_LIMIT_WINDOW_MS as number,
  RATE_LIMIT_MAX_REQUESTS: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  
  // WebSocket
  WS_PING_TIMEOUT: envVars.WS_PING_TIMEOUT as number,
  WS_PING_INTERVAL: envVars.WS_PING_INTERVAL as number,
  WS_MAX_BUFFER_SIZE: envVars.WS_MAX_BUFFER_SIZE as number,
  
  // Session
  SESSION_TIMEOUT: envVars.SESSION_TIMEOUT as number,
  SESSION_CLEANUP_INTERVAL: envVars.SESSION_CLEANUP_INTERVAL as number,
  
  // Queue
  QUEUE_MATCH_TIMEOUT: envVars.QUEUE_MATCH_TIMEOUT as number,
  QUEUE_CLEANUP_INTERVAL: envVars.QUEUE_CLEANUP_INTERVAL as number,
  
  // Logging
  LOG_LEVEL: envVars.LOG_LEVEL as string,
  LOG_FILE_PATH: envVars.LOG_FILE_PATH as string,
  
  // Monitoring
  ENABLE_METRICS: envVars.ENABLE_METRICS as boolean,
  METRICS_PORT: envVars.METRICS_PORT as number,
  
  // Security
  BCRYPT_ROUNDS: envVars.BCRYPT_ROUNDS as number,
  ENABLE_HELMET: envVars.ENABLE_HELMET as boolean,
  
  // File Upload
  MAX_FILE_SIZE: envVars.MAX_FILE_SIZE as number,
  
  // Feature Flags
  ENABLE_FRIEND_SYSTEM: envVars.ENABLE_FRIEND_SYSTEM as boolean,
  ENABLE_REPORTING: envVars.ENABLE_REPORTING as boolean,
  
  // External Services
  TURN_SERVER_URL: envVars.TURN_SERVER_URL as string | undefined,
  TURN_SERVER_USERNAME: envVars.TURN_SERVER_USERNAME as string | undefined,
  TURN_SERVER_CREDENTIAL: envVars.TURN_SERVER_CREDENTIAL as string | undefined,
  
  // Email
  SMTP_HOST: envVars.SMTP_HOST as string | undefined,
  SMTP_PORT: envVars.SMTP_PORT as number | undefined,
  SMTP_USER: envVars.SMTP_USER as string | undefined,
  SMTP_PASS: envVars.SMTP_PASS as string | undefined,
  
  // Error Tracking
  SENTRY_DSN: envVars.SENTRY_DSN as string | undefined,
};

// Print configuration (without sensitive data)
export const printConfig = (): void => {
  console.log('🚀 Application Configuration:');
  console.log(`   Environment: ${ENV.NODE_ENV}`);
  console.log(`   Port: ${ENV.PORT}`);
  console.log(`   Database: ${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}`);
  console.log(`   Redis: ${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`);
  console.log(`   Metrics: ${ENV.ENABLE_METRICS ? 'Enabled' : 'Disabled'}`);
  console.log(`   Friend System: ${ENV.ENABLE_FRIEND_SYSTEM ? 'Enabled' : 'Disabled'}`);
  console.log('');
};

export default ENV;