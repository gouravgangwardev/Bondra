// ============================================
// FILE 2: src/types/session.types.ts
// ============================================
import { SessionType, SessionStatus } from '../config/constants';

// Base session interface
export interface ISession {
  id: string;
  session_type: SessionType;
  user1_id: string;
  user2_id: string;
  status: SessionStatus;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

// Session with user details
export interface ISessionWithUsers {
  id: string;
  session_type: SessionType;
  user1_id: string;
  user2_id: string;
  status: SessionStatus;
  started_at: Date;
  ended_at: Date | null;
  user1_username: string;
  user2_username: string;
  user1_avatar: string | null;
  user2_avatar: string | null;
  duration_seconds: number | null;
}

// Active session data
export interface IActiveSession {
  id: string;
  sessionType: SessionType;
  user1Id: string;
  user2Id: string;
  startedAt: number;
  partnerId?: string;
  partnerUsername?: string;
}

// Session create request
export interface ISessionCreate {
  sessionType: SessionType;
  user1Id: string;
  user2Id: string;
}

// Session statistics
export interface ISessionStats {
  total_sessions: number;
  video_sessions: number;
  audio_sessions: number;
  text_sessions: number;
  avg_duration_seconds: number;
  max_duration_seconds: number;
  min_duration_seconds: number;
}

// Platform session statistics
export interface IPlatformSessionStats {
  active: {
    video: number;
    audio: number;
    text: number;
  };
  platform: {
    total_sessions: number;
    active_sessions: number;
    ended_sessions: number;
    avg_duration_seconds: number;
    sessions_24h: number;
    sessions_7d: number;
  };
  timestamp: number;
}

// Session end reason
export enum SessionEndReason {
  NORMAL = 'normal',
  DISCONNECT = 'disconnect',
  TIMEOUT = 'timeout',
  SKIP = 'skip',
  ERROR = 'error',
}

// Session event
export interface ISessionEvent {
  sessionId: string;
  userId: string;
  eventType: 'start' | 'end' | 'message' | 'signal';
  timestamp: number;
  data?: any;
}

// Queue user
export interface IQueueUser {
  userId: string;
  socketId: string;
  joinedAt: number;
  sessionType: SessionType;
}

// Queue statistics
export interface IQueueStats {
  sizes: {
    video: number;
    audio: number;
    text: number;
  };
  oldestTimes?: {
    [key: string]: {
      userId: string;
      waitTime: number;
    };
  };
  timestamp: number;
}

// Match result
export interface IMatchResult {
  success: boolean;
  sessionId?: string;
  partner?: IQueueUser;
  error?: string;
}

// Matching status
export interface IMatchingStatus {
  inQueue: boolean;
  queueType?: SessionType;
  position?: number;
  estimatedWaitTime?: number;
}
