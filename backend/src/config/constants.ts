// src/config/constants.ts

// Application constants
export const APP_CONSTANTS = {
  NAME: 'RandomChat',
  VERSION: '1.0.0',
  API_PREFIX: '/api/v1',
};

// Session types
export enum SessionType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
}

// Session status
export enum SessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  ABANDONED = 'abandoned',
}

// Friendship status
export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

// User status
export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  IN_CALL = 'in_call',
  AWAY = 'away',
}

// Report reasons
export enum ReportReason {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  UNDERAGE = 'underage',
  VIOLENCE = 'violence',
  OTHER = 'other',
}

// WebSocket events
export const WS_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Authentication
  AUTH: 'auth',
  AUTH_SUCCESS: 'auth:success',
  AUTH_ERROR: 'auth:error',
  
  // Queue management
  QUEUE_JOIN: 'queue:join',
  QUEUE_LEAVE: 'queue:leave',
  QUEUE_ERROR: 'queue:error',
  QUEUE_POSITION: 'queue:position',
  
  // Matching
  MATCH_FOUND: 'match:found',
  MATCH_DISCONNECTED: 'match:disconnected',
  MATCH_NEXT: 'match:next',
  MATCH_ERROR: 'match:error',
  
  // WebRTC signaling
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',
  CALL_ICE_CANDIDATE: 'call:ice',
  CALL_END: 'call:end',
  CALL_ERROR: 'call:error',
  
  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_STOP_TYPING: 'chat:stop_typing',
  
  // Friend system
  FRIEND_REQUEST_SEND: 'friend:request:send',
  FRIEND_REQUEST_RECEIVED: 'friend:request:received',
  FRIEND_REQUEST_ACCEPT: 'friend:request:accept',
  FRIEND_REQUEST_REJECT: 'friend:request:reject',
  FRIEND_ONLINE: 'friend:online',
  FRIEND_OFFLINE: 'friend:offline',
  FRIEND_CALL: 'friend:call',
  FRIEND_LIST: 'friend:list',
  
  // Reporting
  REPORT_USER: 'report:user',
  REPORT_SUCCESS: 'report:success',
  REPORT_ERROR: 'report:error',
  
  // Status updates
  STATUS_UPDATE: 'status:update',
  USER_COUNT: 'user:count',
};

// Redis pub/sub channels
export const REDIS_CHANNELS = {
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  MATCH_FOUND: 'match:found',
  SESSION_END: 'session:end',
  FRIEND_REQUEST: 'friend:request',
  FRIEND_ACCEPT: 'friend:accept',
  BROADCAST: 'broadcast',
};

// Queue configuration
export const QUEUE_CONFIG = {
  MAX_WAIT_TIME: 60000,           // 60 seconds max wait
  MATCH_INTERVAL: 2000,           // Check for matches every 2 seconds
  CLEANUP_INTERVAL: 10000,        // Cleanup stale entries every 10 seconds
  MAX_QUEUE_SIZE: 1000,           // Max users in queue
};

// Session configuration
export const SESSION_CONFIG = {
  MAX_DURATION: 3600000,          // 1 hour max session
  IDLE_TIMEOUT: 300000,           // 5 minutes idle timeout
  RECONNECT_WINDOW: 30000,        // 30 seconds to reconnect
  MAX_RECONNECT_ATTEMPTS: 3,      // Max 3 reconnection attempts
};

// Rate limiting
export const RATE_LIMITS = {
  // API endpoints
  API_GENERAL: {
    windowMs: 15 * 60 * 1000,     // 15 minutes
    max: 100,                      // 100 requests
  },
  
  API_AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5,                        // 5 login attempts
  },
  
  API_REPORT: {
    windowMs: 60 * 60 * 1000,     // 1 hour
    max: 10,                       // 10 reports
  },
  
  // WebSocket events
  WS_CONNECTION: {
    windowMs: 60 * 1000,          // 1 minute
    max: 10,                       // 10 connections
  },
  
  WS_MESSAGE: {
    windowMs: 1000,               // 1 second
    max: 20,                       // 20 messages
  },
  
  WS_QUEUE_JOIN: {
    windowMs: 5000,               // 5 seconds
    max: 3,                        // 3 attempts
  },
};

// Error codes
export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  
  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_BANNED: 'USER_BANNED',
  
  // Session
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  
  // Queue
  QUEUE_FULL: 'QUEUE_FULL',
  QUEUE_ALREADY_IN: 'QUEUE_ALREADY_IN',
  QUEUE_TIMEOUT: 'QUEUE_TIMEOUT',
  
  // Friends
  FRIEND_REQUEST_EXISTS: 'FRIEND_REQUEST_EXISTS',
  FRIEND_REQUEST_NOT_FOUND: 'FRIEND_REQUEST_NOT_FOUND',
  ALREADY_FRIENDS: 'ALREADY_FRIENDS',
  CANNOT_FRIEND_SELF: 'CANNOT_FRIEND_SELF',
  
  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

// Success messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  FRIEND_REQUEST_SENT: 'Friend request sent',
  FRIEND_REQUEST_ACCEPTED: 'Friend request accepted',
  REPORT_SUBMITTED: 'Report submitted successfully',
};

// Validation rules
export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: false,
  },
  
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  
  MESSAGE: {
    MAX_LENGTH: 1000,
  },
  
  REPORT_REASON: {
    MAX_LENGTH: 500,
  },
};

// WebRTC ICE servers configuration
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // TURN servers can be added here in production
];

// Monitoring thresholds
export const MONITORING = {
  CPU_THRESHOLD: 80,              // Alert at 80% CPU
  MEMORY_THRESHOLD: 85,            // Alert at 85% memory
  QUEUE_SIZE_THRESHOLD: 500,       // Alert at 500 in queue
  RESPONSE_TIME_THRESHOLD: 1000,   // Alert if response > 1s
  ERROR_RATE_THRESHOLD: 0.05,      // Alert at 5% error rate
};

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  USER_PROFILE: 300,               // 5 minutes
  FRIEND_LIST: 60,                 // 1 minute
  ONLINE_STATUS: 30,               // 30 seconds
  QUEUE_STATS: 10,                 // 10 seconds
  SESSION_DATA: 3600,              // 1 hour
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// File upload (for future features)
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024,      // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif'],
};

// Security
export const SECURITY = {
  JWT_ALGORITHM: 'HS256',
  BCRYPT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
};

// Feature flags (can be moved to database in future)
export const FEATURE_FLAGS = {
  ENABLE_REGISTRATION: true,
  ENABLE_FRIEND_SYSTEM: true,
  ENABLE_VIDEO_CHAT: true,
  ENABLE_AUDIO_CHAT: true,
  ENABLE_TEXT_CHAT: true,
  ENABLE_REPORTING: true,
  ENABLE_GUEST_MODE: true,
  ENABLE_GROUP_CALLS: false,       // Future feature
  ENABLE_FILE_SHARING: false,      // Future feature
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export default {
  APP_CONSTANTS,
  SessionType,
  SessionStatus,
  FriendshipStatus,
  UserStatus,
  ReportReason,
  WS_EVENTS,
  REDIS_CHANNELS,
  QUEUE_CONFIG,
  SESSION_CONFIG,
  RATE_LIMITS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  VALIDATION_RULES,
  ICE_SERVERS,
  MONITORING,
  CACHE_TTL,
  PAGINATION,
  FILE_UPLOAD,
  SECURITY,
  FEATURE_FLAGS,
  HTTP_STATUS,
};
