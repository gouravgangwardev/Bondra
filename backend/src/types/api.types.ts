// ============================================
// FILE 4: src/types/api.types.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { IUser, IPublicUser } from './user.types';

// Extended Express Request with user
export interface IAuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    isGuest: boolean;
  };
}

// Standard API response
export interface IApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
  cached?: boolean;
}

// Paginated API response
export interface IPaginatedResponse<T = any> extends IApiResponse<T> {
  data: {
    items: T[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Error response
export interface IErrorResponse extends IApiResponse {
  success: false;
  error: string;
  code?: string;
  statusCode?: number;
  stack?: string;
}

// Validation error
export interface IValidationError {
  field: string;
  message: string;
  value?: any;
}

// Pagination params
export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Filter params
export interface IFilterParams {
  [key: string]: any;
}

// Query params
export interface IQueryParams extends IPaginationParams {
  filters?: IFilterParams;
  search?: string;
}

// Auth controller responses
export namespace AuthAPI {
  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
  }

  export interface LoginRequest {
    username: string;
    password: string;
  }

  export interface RefreshTokenRequest {
    refreshToken: string;
  }

  export interface ChangePasswordRequest {
    oldPassword: string;
    newPassword: string;
  }

  export interface AuthResponse {
    user: IPublicUser;
    accessToken: string;
    refreshToken: string;
  }
}

// User controller responses
export namespace UserAPI {
  export interface UpdateProfileRequest {
    username?: string;
    email?: string;
    avatar_url?: string;
  }

  export interface SearchUsersRequest {
    q: string;
    limit?: number;
  }

  export interface UserProfileResponse {
    user: IPublicUser;
    stats?: {
      total_sessions: number;
      total_friends: number;
      reports_made: number;
      reports_received: number;
    };
  }
}

// Friend controller responses
export namespace FriendAPI {
  export interface SendRequestRequest {
    friendId: string;
  }

  export interface AcceptRequestRequest {
    friendId: string;
  }

  export interface RejectRequestRequest {
    friendId: string;
  }

  export interface BlockUserRequest {
    friendId: string;
  }

  export interface FriendListResponse {
    friends: any[];
    count: number;
  }

  export interface FriendStatsResponse {
    total_friends: number;
    online_friends: number;
    pending_requests: number;
    sent_requests: number;
  }
}

// Session controller responses
export namespace SessionAPI {
  export interface CreateSessionRequest {
    sessionType: string;
    partnerId: string;
  }

  export interface SessionHistoryRequest {
    page?: number;
    limit?: number;
  }

  export interface SessionStatsResponse {
    total_sessions: number;
    video_sessions: number;
    audio_sessions: number;
    text_sessions: number;
    avg_duration_seconds: number;
  }
}

// Report controller responses
export namespace ReportAPI {
  export interface SubmitReportRequest {
    reportedUserId: string;
    reason: string;
    description?: string;
    sessionId?: string;
  }

  export interface UpdateReportRequest {
    status: 'reviewed' | 'resolved' | 'dismissed';
  }

  export interface ResolveReportRequest {
    action: 'ban' | 'warn' | 'dismiss';
  }

  export interface ReportListResponse {
    reports: any[];
    page: number;
    limit: number;
    count: number;
  }

  export interface ReportStatsResponse {
    overall: {
      total_reports: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
      reports_24h: number;
      reports_7d: number;
    };
    by_reason: any[];
    most_reported: any[];
  }
}

// Health controller responses
export namespace HealthAPI {
  export interface HealthCheckResponse {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    environment?: string;
    checks?: {
      database: 'healthy' | 'unhealthy' | 'unknown';
      redis: 'healthy' | 'unhealthy' | 'unknown';
      cache: 'healthy' | 'unhealthy' | 'unknown';
    };
    performance?: {
      memory: NodeJS.MemoryUsage;
      cpu: number[];
    };
  }

  export interface SystemStatsResponse {
    system: {
      platform: string;
      arch: string;
      cpus: number;
      totalMemory: number;
      freeMemory: number;
      uptime: number;
      loadAverage: number[];
    };
    process: {
      version: string;
      uptime: number;
      memory: NodeJS.MemoryUsage;
      pid: number;
    };
    database: {
      total: number;
      idle: number;
      waiting: number;
    };
  }

  export interface AppStatsResponse {
    sessions: any;
    queues: {
      video: number;
      audio: number;
      text: number;
    };
    cluster: any;
    cache: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      hitRate: number;
    };
  }
}

// Middleware types
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export type ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// Rate limit info
export interface IRateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// File upload types
export interface IFileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Metrics types
export interface IMetrics {
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  activeConnections: number;
  queueSizes: {
    video: number;
    audio: number;
    text: number;
  };
  activeSessions: number;
  onlineUsers: number;
}
