// src/services/api.ts
import { API_BASE_URL } from '../utils/constants';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// ── Token refresh interceptor ─────────────────────────────────────────────────
// Single in-flight refresh promise so concurrent 401s don't trigger
// multiple simultaneous refresh calls.

let _isRefreshing = false;
let _refreshPromise: Promise<string> | null = null;

const _doLogoutCleanup = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // Trigger a storage event so AuthContext re-reads and sets user=null
  window.dispatchEvent(new Event('auth:logout'));
};

/**
 * Wraps fetch for authenticated requests.
 * On 401 → calls /auth/refresh, retries once with the new token.
 * If refresh fails → clears auth state and throws.
 */
const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Always inject the latest auth headers
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers ?? {}) },
  });

  if (response.status !== 401) return response;

  // ── 401 received — try to refresh ──────────────────────────────────────────
  const storedRefreshToken = localStorage.getItem('refreshToken');
  if (!storedRefreshToken) {
    _doLogoutCleanup();
    throw new Error('Session expired. Please log in again.');
  }

  if (!_isRefreshing) {
    _isRefreshing = true;
    _refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Refresh failed');
        const body = await r.json();
        const newToken: string = body?.data?.accessToken ?? body?.accessToken;
        if (!newToken) throw new Error('No access token in refresh response');
        localStorage.setItem('accessToken', newToken);
        return newToken;
      })
      .catch((err) => {
        _doLogoutCleanup();
        throw err;
      })
      .finally(() => {
        _isRefreshing = false;
        _refreshPromise = null;
      });
  }

  // Wait for the shared refresh to settle (success or failure)
  await _refreshPromise;

  // Retry original request with updated token
  return fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers ?? {}) },
  });
};

// Generic response handler — returns the full parsed JSON body.
// Callers that need a specific field extract it after calling handleResponse.
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
};

const unwrapData = <T>(body: any): T => {
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object') {
    return body.data as T;
  }
  return body as T;
};

// ── Auth ─────────────────────────────────────────────────────────────────────
// Backend now returns flat: { success, user, accessToken, refreshToken }
// These functions pass the full response body through — callers destructure directly.

export const authAPI = {
  register: async (data: { username: string; email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await handleResponse<any>(response);
    return unwrapData<{ user: any; accessToken: string; refreshToken: string }>(body);
  },

  // FIX: login sends { email, password } — backend now accepts either email or username.
  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.email,
        password: credentials.password,
      }),
    });
    const body = await handleResponse<any>(response);
    return unwrapData<{ user: any; accessToken: string; refreshToken: string }>(body);
  },

  loginAsGuest: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/guest`, { method: 'POST' });
    const body = await handleResponse<any>(response);
    return unwrapData<{ user: any; accessToken: string; refreshToken: string }>(body);
  },

  // FIX: backend now returns flat { success, accessToken } — no data: wrapper.
  refreshToken: async (refreshToken: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const body = await handleResponse<any>(response);
    return unwrapData<{ accessToken: string }>(body);
  },

  logout: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const userAPI = {
  getProfile: async (userId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`);
    return handleResponse<any>(response);
  },

  updateProfile: async (data: { username?: string; bio?: string }) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('accessToken');
    // multipart/form-data — do NOT set Content-Type (browser sets boundary automatically)
    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    if (response.status === 401) {
      // Manual refresh for multipart since fetchWithAuth injects Content-Type
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        _doLogoutCleanup();
        throw new Error('Session expired. Please log in again.');
      }
      await authAPI.refreshToken(storedRefreshToken).then(({ accessToken }) => {
        localStorage.setItem('accessToken', accessToken);
      }).catch(() => { _doLogoutCleanup(); });
      const newToken = localStorage.getItem('accessToken');
      const retried = await fetch(`${API_BASE_URL}/users/me/avatar`, {
        method: 'POST',
        headers: { ...(newToken && { Authorization: `Bearer ${newToken}` }) },
        body: formData,
      });
      return handleResponse<{ avatarUrl: string }>(retried);
    }
    return handleResponse<{ avatarUrl: string }>(response);
  },

  getUserStats: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/stats`);
    return handleResponse<any>(response);
  },

  searchUsers: async (query: string) => {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`
    );
    return handleResponse<any[]>(response);
  },

  // FIX: backend now returns { success, count } — extract count directly.
  getActiveUserCount: async (): Promise<number> => {
    const response = await fetch(`${API_BASE_URL}/users/active-count`);
    const body = await handleResponse<{ success: boolean; count: number }>(response);
    return body.count;
  },
};

// ── Friends ───────────────────────────────────────────────────────────────────
// Backend now returns flat: { success, friends: [...], count }
// Helpers below extract the array so callers get a plain array back.

export const friendsAPI = {
  // FIX: extract .friends from flat response { success, friends, count }
  getFriends: async (): Promise<any[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends`);
    const body = await handleResponse<{ success: boolean; friends: any[]; count: number }>(response);
    return body.friends ?? [];
  },

  getPendingRequests: async (): Promise<any[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/pending`);
    const body = await handleResponse<{ success: boolean; requests: any[]; count: number }>(response);
    return body.requests ?? [];
  },

  getSentRequests: async (): Promise<any[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/sent`);
    const body = await handleResponse<{ success: boolean; requests: any[]; count: number }>(response);
    return body.requests ?? [];
  },

  getOnlineFriends: async (): Promise<any[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/online`);
    const body = await handleResponse<{ success: boolean; friends: any[]; count: number }>(response);
    return body.friends ?? [];
  },

  sendRequest: async (friendId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/request`, {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  acceptRequest: async (friendId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/accept`, {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  rejectRequest: async (friendId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/reject`, {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  removeFriend: async (friendId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/${friendId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ message: string }>(response);
  },

  // FIX: frontend was sending { userId } — backend now accepts userId||friendId.
  blockUser: async (userId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/block`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  getFriendshipStatus: async (friendId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/friends/${friendId}/status`);
    // Backend now returns { success, friendshipStatus, isOnline }
    return handleResponse<{ friendshipStatus: any; isOnline: boolean }>(response);
  },
};

// ── Reports ───────────────────────────────────────────────────────────────────

export const reportsAPI = {
  submitReport: async (data: {
    reportedUserId: string;
    sessionId?: string;
    reason: string;
    description?: string;
  }) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/reports`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
  },

  getMyReports: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/reports/my`);
    return handleResponse<any[]>(response);
  },
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthAPI = {
  getQueueStats: async () => {
    const response = await fetch(`${API_BASE_URL}/health/queue`);
    return handleResponse<any>(response);
  },

  // FIX: returns extracted count directly (was previously returning full body
  // and callers had to know the field name changed from activeUsers → count).
  getActiveUserCount: async (): Promise<number> => {
    return userAPI.getActiveUserCount();
  },
};

export default {
  auth:    authAPI,
  user:    userAPI,
  friends: friendsAPI,
  reports: reportsAPI,
  health:  healthAPI,
};