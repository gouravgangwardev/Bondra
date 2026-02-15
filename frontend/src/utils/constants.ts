// src/utils/constants.ts

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_ || 'http://localhost:3000/api/v1';
export const SOCKET_URL = process.env.REACT_APP_ || 'http://localhost:3000';

// App Metadata
export const APP_NAME = 'RandomChat';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Connect with strangers from around the world';

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  CHAT: '/chat',
  FRIENDS: '/friends',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  NOT_FOUND: '*',
} as const;

// Chat Modes
export const CHAT_MODES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  TEXT: 'text',
} as const;

// Friend Status
export const FRIEND_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  AWAY: 'away',
} as const;

// Message Status
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

// Matching States
export const MATCHING_STATES = {
  IDLE: 'idle',
  SELECTING: 'selecting',
  SEARCHING: 'searching',
  MATCHED: 'matched',
  FAILED: 'failed',
} as const;

// WebRTC Configuration
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

// Media Constraints
export const MEDIA_CONSTRAINTS = {
  VIDEO: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
  },
  AUDIO: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  },
} as const;

// Socket Events
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Presence
  PRESENCE_ONLINE_COUNT: 'presence:online-count',

  // Matching
  MATCHING_JOIN_QUEUE: 'matching:join-queue',
  MATCHING_LEAVE_QUEUE: 'matching:leave-queue',
  MATCHING_QUEUE_UPDATE: 'matching:queue-update',
  MATCHING_MATCHED: 'matching:matched',
  MATCHING_NO_MATCH: 'matching:no-match',

  // Chat
  CHAT_SEND_MESSAGE: 'chat:send-message',
  CHAT_MESSAGE: 'chat:message',
  CHAT_MESSAGE_SENT: 'chat:message-sent',
  CHAT_MESSAGE_DELIVERED: 'chat:message-delivered',
  CHAT_MESSAGE_READ: 'chat:message-read',
  CHAT_TYPING: 'chat:typing',
  CHAT_REACTION: 'chat:reaction',
  CHAT_SKIP: 'chat:skip',
  CHAT_END_SESSION: 'chat:end-session',
  CHAT_REPORT: 'chat:report',
  CHAT_PARTNER_DISCONNECTED: 'chat:partner-disconnected',
  CHAT_SESSION_ENDED: 'chat:session-ended',

  // WebRTC
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',

  // Friends
  FRIENDS_REQUEST_RECEIVED: 'friends:request-received',
  FRIENDS_REQUEST_ACCEPTED: 'friends:request-accepted',
  FRIENDS_ONLINE: 'friends:online',
  FRIENDS_OFFLINE: 'friends:offline',
} as const;

// Timeouts & Delays
export const TIMEOUTS = {
  TYPING_INDICATOR: 3000, // 3 seconds
  MESSAGE_RETRY: 5000, // 5 seconds
  SESSION_TIMEOUT: 1800000, // 30 minutes
  RECONNECT_DELAY: 1000, // 1 second
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// Validation
export const VALIDATION = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 8,
  BIO_MAX_LENGTH: 500,
  MESSAGE_MAX_LENGTH: 1000,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Report Reasons
export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or Advertising' },
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_profile', label: 'Fake Profile' },
  { value: 'underage', label: 'Underage User' },
  { value: 'other', label: 'Other' },
] as const;

// Avatar Gradients
export const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
] as const;

// Quick Reactions
export const QUICK_REACTIONS = ['😂', '❤️', '👍', '😮', '😢', '🔥'] as const;

// Theme
export const THEME = {
  COLORS: {
    PRIMARY: 'violet',
    SECONDARY: 'indigo',
    SUCCESS: 'emerald',
    WARNING: 'amber',
    ERROR: 'red',
    INFO: 'cyan',
  },
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Please login to continue.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTER_SUCCESS: 'Account created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  FRIEND_REQUEST_SENT: 'Friend request sent!',
  FRIEND_REQUEST_ACCEPTED: 'Friend request accepted!',
  MESSAGE_SENT: 'Message sent!',
} as const;
