// ============================================
// FILE 3: src/types/websocket.types.ts
// ============================================
import { Socket } from 'socket.io';
import { SessionType } from '../config/constants';

// Extended Socket with user data
export interface IAuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  isGuest?: boolean;
  sessionId?: string;
}

// WebSocket event types
export enum WSEventType {
  // Connection
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Authentication
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth:success',
  AUTH_ERROR = 'auth:error',
  
  // Queue
  QUEUE_JOIN = 'queue:join',
  QUEUE_LEAVE = 'queue:leave',
  QUEUE_ERROR = 'queue:error',
  QUEUE_POSITION = 'queue:position',
  
  // Matching
  MATCH_FOUND = 'match:found',
  MATCH_DISCONNECTED = 'match:disconnected',
  MATCH_NEXT = 'match:next',
  MATCH_ERROR = 'match:error',
  
  // WebRTC Signaling
  CALL_OFFER = 'call:offer',
  CALL_ANSWER = 'call:answer',
  CALL_ICE = 'call:ice',
  CALL_END = 'call:end',
  CALL_ERROR = 'call:error',
  
  // Chat
  CHAT_MESSAGE = 'chat:message',
  CHAT_TYPING = 'chat:typing',
  CHAT_STOP_TYPING = 'chat:stop_typing',
  
  // Friends
  FRIEND_REQUEST_SEND = 'friend:request:send',
  FRIEND_REQUEST_RECEIVED = 'friend:request:received',
  FRIEND_REQUEST_ACCEPT = 'friend:request:accept',
  FRIEND_REQUEST_REJECT = 'friend:request:reject',
  FRIEND_ONLINE = 'friend:online',
  FRIEND_OFFLINE = 'friend:offline',
  FRIEND_CALL = 'friend:call',
  FRIEND_LIST = 'friend:list',
  
  // Reports
  REPORT_USER = 'report:user',
  REPORT_SUCCESS = 'report:success',
  REPORT_ERROR = 'report:error',
  
  // Status
  STATUS_UPDATE = 'status:update',
  USER_COUNT = 'user:count',
}

// Auth request
export interface IWSAuthRequest {
  token: string;
}

// Auth response
export interface IWSAuthResponse {
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}

// Queue join request
export interface IWSQueueJoinRequest {
  type: SessionType;
}

// Queue position update
export interface IWSQueuePosition {
  position: number;
  queueSize: number;
  estimatedWaitTime: number;
}

// Match found event
export interface IWSMatchFound {
  sessionId: string;
  partnerId: string;
  partnerUsername: string;
  sessionType: SessionType;
}

// Match disconnected event
export interface IWSMatchDisconnected {
  sessionId: string;
  reason: 'left' | 'timeout' | 'error';
}

// WebRTC offer/answer
export interface IWSRTCSignal {
  sessionId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// Chat message
export interface IWSChatMessage {
  sessionId: string;
  message: string;
  timestamp: number;
  senderId: string;
}

// Typing indicator
export interface IWSTypingIndicator {
  sessionId: string;
  userId: string;
  isTyping: boolean;
}

// Friend request event
export interface IWSFriendRequest {
  friendId: string;
  username?: string;
}

// Friend online/offline event
export interface IWSFriendStatus {
  friendId: string;
  username: string;
  isOnline: boolean;
}

// Friend call request
export interface IWSFriendCall {
  friendId: string;
  type: SessionType;
}

// Report user event
export interface IWSReportUser {
  reportedUserId: string;
  reason: string;
  description?: string;
  sessionId?: string;
}

// Status update event
export interface IWSStatusUpdate {
  userId: string;
  status: 'online' | 'away' | 'in_call';
}

// User count update
export interface IWSUserCount {
  total: number;
  online: number;
  inCall: number;
}

// WebSocket error
export interface IWSError {
  code: string;
  message: string;
  details?: any;
}

// WebSocket middleware data
export interface IWSMiddlewareData {
  socket: IAuthenticatedSocket;
  data: any;
  next: (err?: Error) => void;
}

// WebSocket rate limit data
export interface IWSRateLimit {
  event: string;
  limit: number;
  window: number;
  cost: number;
}

// Socket room types
export enum SocketRoom {
  USER = 'user:',
  SESSION = 'session:',
  QUEUE = 'queue:',
  GLOBAL = 'global',
}
