// src/types/index.ts

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  bio?: string;
  isGuest?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export type FriendStatus = 'online' | 'offline' | 'busy' | 'away';
export type QueueType = 'video' | 'audio' | 'text';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MatchingState = 'idle' | 'selecting' | 'searching' | 'matched' | 'failed';

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  status?: MessageStatus;
  type?: 'text' | 'system';
  reactions?: Record<string, number>;
  isOwn?: boolean;
}

export interface Friend {
  id: string;
  username: string;
  avatar?: string | null;
  status: FriendStatus;
  lastSeen?: Date;
  mutualFriends?: number;
  isBlocked?: boolean;
}

export interface MatchedUser {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface QueueStats {
  type: QueueType;
  usersInQueue: number;
  estimatedWaitTime: number;
  activeChats: number;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  status?: MessageStatus;
  type?: 'text' | 'system';
  reactions?: Record<string, number>;
  isOwn?: boolean;
}
