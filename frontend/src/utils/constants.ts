// src/utils/constants.ts

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
export const SOCKET_URL   = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// App Metadata
export const APP_NAME        = import.meta.env.VITE_APP_NAME        || 'RandomChat';
export const APP_VERSION     = import.meta.env.VITE_APP_VERSION     || '1.0.0';
export const APP_DESCRIPTION = import.meta.env.VITE_APP_DESCRIPTION || 'Connect with strangers from around the world';

// Feature Flags
export const FEATURE_FLAGS = {
  GUEST_MODE:    import.meta.env.VITE_ENABLE_GUEST_MODE    !== 'false',
  NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
  VIDEO_CHAT:    import.meta.env.VITE_ENABLE_VIDEO_CHAT    !== 'false',
  AUDIO_CHAT:    import.meta.env.VITE_ENABLE_AUDIO_CHAT    !== 'false',
  TEXT_CHAT:     import.meta.env.VITE_ENABLE_TEXT_CHAT     !== 'false',
  ANALYTICS:     import.meta.env.VITE_ENABLE_ANALYTICS     === 'true',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN:  'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER:          'user',
  THEME:         'theme',
  LANGUAGE:      'language',
} as const;

// Route Paths
export const ROUTES = {
  HOME:      '/',
  LOGIN:     '/login',
  REGISTER:  '/register',
  DASHBOARD: '/dashboard',
  CHAT:      '/chat',
  FRIENDS:   '/friends',
  PROFILE:   '/profile',
  SETTINGS:  '/settings',
  NOT_FOUND: '*',
} as const;

// Chat Modes
export const CHAT_MODES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  TEXT:  'text',
} as const;

// Friend Status
export const FRIEND_STATUS = {
  ONLINE:  'online',
  OFFLINE: 'offline',
  BUSY:    'busy',
  AWAY:    'away',
} as const;

// Message Status
export const MESSAGE_STATUS = {
  SENDING:   'sending',
  SENT:      'sent',
  DELIVERED: 'delivered',
  READ:      'read',
  FAILED:    'failed',
} as const;

// Matching States
export const MATCHING_STATES = {
  IDLE:      'idle',
  SELECTING: 'selecting',
  SEARCHING: 'searching',
  MATCHED:   'matched',
  FAILED:    'failed',
} as const;

// WebRTC ICE — reads TURN credentials from env; falls back to STUN-only for local dev
const TURN_SERVER    = import.meta.env.VITE_TURN_SERVER_URL;
const TURN_USERNAME  = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302'  },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // TURN is required for ~20 % of users behind symmetric NAT.
  // Free tier: https://www.metered.ca/tools/openrelay/
  ...(TURN_SERVER
    ? [{ urls: TURN_SERVER, username: TURN_USERNAME, credential: TURN_CREDENTIAL }]
    : []),
];

// Media Constraints
export const MEDIA_CONSTRAINTS = {
  VIDEO: {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  },
  AUDIO: {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  },
} as const;

// ---------------------------------------------------------------------------
// Socket Events — these MUST match backend src/websocket/types/events.ts
// ---------------------------------------------------------------------------
export const SOCKET_EVENTS = {
  // Connection
  CONNECT:    'connect',
  DISCONNECT: 'disconnect',
  ERROR:      'error',

  // Auth (server → client after successful WS auth)
  AUTH_SUCCESS: 'auth:success',

  // Presence
  USER_COUNT: 'user:count',

  // Queue (client → server)
  QUEUE_JOIN:  'queue:join',
  QUEUE_LEAVE: 'queue:leave',
  // Queue (server → client)
  QUEUE_POSITION: 'queue:position',
  QUEUE_ERROR:    'queue:error',

  // Matching (server → client)
  MATCH_FOUND:        'match:found',
  MATCH_DISCONNECTED: 'match:disconnected',
  // Matching (client → server)
  MATCH_NEXT: 'match:next',

  // WebRTC signaling — both directions
  CALL_OFFER:          'call:offer',
  CALL_ANSWER:         'call:answer',
  CALL_ICE_CANDIDATE:  'call:ice',
  CALL_END:            'call:end',
  CALL_ERROR:          'call:error',

  // Chat — both directions
  CHAT_MESSAGE:      'chat:message',
  CHAT_TYPING:       'chat:typing',
  CHAT_STOP_TYPING:  'chat:stop_typing',

  // Friends (client → server)
  FRIEND_REQUEST_SEND:   'friend:request:send',
  FRIEND_REQUEST_ACCEPT: 'friend:request:accept',
  FRIEND_REQUEST_REJECT: 'friend:request:reject',
  FRIEND_CALL:           'friend:call',
  FRIEND_LIST:           'friend:list',
  // Friends (server → client)
  FRIEND_REQUEST_RECEIVED: 'friend:request:received',
  FRIEND_ONLINE:           'friend:online',
  FRIEND_OFFLINE:          'friend:offline',

  // Reports (client → server)
  REPORT_USER: 'report:user',
  // Reports (server → client)
  REPORT_SUCCESS: 'report:success',
  REPORT_ERROR:   'report:error',
} as const;

// Timeouts & Delays
export const TIMEOUTS = {
  TYPING_INDICATOR:     3000,
  MESSAGE_RETRY:        5000,
  SESSION_TIMEOUT:      1800000,
  RECONNECT_DELAY:      1000,
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// Validation
export const VALIDATION = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 8,
  BIO_MAX_LENGTH:      500,
  MESSAGE_MAX_LENGTH:  1000,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Report Reasons
export const REPORT_REASONS = [
  { value: 'spam',                 label: 'Spam or Advertising'    },
  { value: 'harassment',           label: 'Harassment or Bullying' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_profile',         label: 'Fake Profile'           },
  { value: 'underage',             label: 'Underage User'          },
  { value: 'other',                label: 'Other'                  },
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
    PRIMARY:   'violet',
    SECONDARY: 'indigo',
    SUCCESS:   'emerald',
    WARNING:   'amber',
    ERROR:     'red',
    INFO:      'cyan',
  },
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE:     100,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR:    'Network error. Please check your connection.',
  UNAUTHORIZED:     'Please login to continue.',
  FORBIDDEN:        'You do not have permission to access this resource.',
  NOT_FOUND:        'The requested resource was not found.',
  SERVER_ERROR:     'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS:            'Welcome back!',
  REGISTER_SUCCESS:         'Account created successfully!',
  PROFILE_UPDATED:          'Profile updated successfully!',
  FRIEND_REQUEST_SENT:      'Friend request sent!',
  FRIEND_REQUEST_ACCEPTED:  'Friend request accepted!',
  MESSAGE_SENT:             'Message sent!',
} as const;
