// ============================================
// FILE 1: src/types/user.types.ts
// ============================================
import { FriendshipStatus, UserStatus } from '../config/constants';

// Base user interface
export interface IUser {
  id: string;
  username: string;
  email: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  is_guest: boolean;
  is_banned: boolean;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
}

// User without sensitive data (for API responses)
export interface IPublicUser {
  id: string;
  username: string;
  avatar_url: string | null;
  is_guest: boolean;
  last_seen: Date;
  created_at: Date;
}

// User creation data
export interface IUserCreate {
  username: string;
  email?: string;
  password?: string;
  is_guest?: boolean;
  avatar_url?: string;
}

// User update data
export interface IUserUpdate {
  username?: string;
  email?: string;
  avatar_url?: string;
  last_seen?: Date;
}

// User profile with statistics
export interface IUserProfile extends IPublicUser {
  stats: IUserStats;
  isOnline: boolean;
}

// User statistics
export interface IUserStats {
  total_sessions: number;
  total_friends: number;
  reports_made: number;
  reports_received: number;
}

// User search result
export interface IUserSearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  is_guest: boolean;
  is_online: boolean;
  mutual_friends?: number;
}

// User preferences
export interface IUserPreferences {
  notifications_enabled: boolean;
  auto_accept_friends: boolean;
  show_online_status: boolean;
  preferred_language: string;
}

// User session info (for JWT)
export interface IUserSession {
  userId: string;
  username: string;
  isGuest: boolean;
  sessionId?: string;
}

// Authentication payload
export interface IAuthPayload {
  user: IPublicUser;
  accessToken: string;
  refreshToken: string;
}

// Login credentials
export interface ILoginCredentials {
  username: string;
  password: string;
}

// Registration data
export interface IRegistrationData {
  username: string;
  email: string;
  password: string;
}

// Password change request
export interface IPasswordChange {
  oldPassword: string;
  newPassword: string;
}

// User presence information
export interface IUserPresence {
  userId: string;
  status: UserStatus;
  socketId?: string;
  lastSeen: number;
}

// Friend relationship
export interface IFriendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
}

// Friend with details
export interface IFriendWithDetails {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  friend_username: string;
  friend_avatar_url: string | null;
  friend_last_seen: Date;
  is_online: boolean;
  created_at: Date;
}

// Friend request
export interface IFriendRequest {
  id: string;
  from_user: IPublicUser;
  to_user: IPublicUser;
  status: FriendshipStatus;
  created_at: Date;
}