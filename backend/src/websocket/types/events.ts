// ============================================
// FILE 1: src/websocket/types/events.ts
// ============================================
export enum WSEvents {
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
  QUEUE_POSITION = 'queue:position',
  QUEUE_ERROR = 'queue:error',
  
  // Matching
  MATCH_FOUND = 'match:found',
  MATCH_DISCONNECTED = 'match:disconnected',
  MATCH_NEXT = 'match:next',
  MATCH_ERROR = 'match:error',
  
  // WebRTC Signaling
  CALL_OFFER = 'call:offer',
  CALL_ANSWER = 'call:answer',
  CALL_ICE_CANDIDATE = 'call:ice',
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
  
  // Status
  STATUS_UPDATE = 'status:update',
  USER_COUNT = 'user:count',
  
  // Report
  REPORT_USER = 'report:user',
  REPORT_SUCCESS = 'report:success',
  REPORT_ERROR = 'report:error',
}

export interface AuthPayload {
  token: string;
}

export interface QueueJoinPayload {
  type: 'video' | 'audio' | 'text';
}

export interface MatchFoundPayload {
  sessionId: string;
  partnerId: string;
  partnerUsername: string;
  sessionType: string;
}

export interface CallOfferPayload {
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  answer: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

export interface ChatMessagePayload {
  message: string;
  timestamp?: number;
}

export interface FriendCallPayload {
  friendId: string;
  type: 'video' | 'audio';
}

export interface ReportUserPayload {
  reportedUserId: string;
  reason: string;
  description?: string;
  sessionId?: string;
}

export interface SocketData {
  userId: string;
  username: string;
  isGuest: boolean;
  authenticated: boolean;
}
