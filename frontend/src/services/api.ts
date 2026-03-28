// src/services/api.ts
import { API_BASE_URL } from '../utils/constants';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
};

export const authAPI = {
  register: async (data: { username: string; email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ user: any; accessToken: string; refreshToken: string }>(response);
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return handleResponse<{ user: any; accessToken: string; refreshToken: string }>(response);
  },

  loginAsGuest: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/guest`, { method: 'POST' });
    return handleResponse<{ user: any; accessToken: string; refreshToken: string }>(response);
  },

  refreshToken: async (refreshToken: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return handleResponse<{ accessToken: string }>(response);
  },

  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(response);
  },
};

export const userAPI = {
  getProfile: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getAuthHeaders() });
    return handleResponse<any>(response);
  },

  updateProfile: async (data: { username?: string; bio?: string }) => {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    return handleResponse<{ avatarUrl: string }>(response);
  },

  getUserStats: async () => {
    const response = await fetch(`${API_BASE_URL}/users/stats`, { headers: getAuthHeaders() });
    return handleResponse<any>(response);
  },

  searchUsers: async (query: string) => {
    const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },
};

export const friendsAPI = {
  getFriends: async () => {
    const response = await fetch(`${API_BASE_URL}/friends`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  getPendingRequests: async () => {
    const response = await fetch(`${API_BASE_URL}/friends/pending`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  getSentRequests: async () => {
    const response = await fetch(`${API_BASE_URL}/friends/sent`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  getOnlineFriends: async () => {
    const response = await fetch(`${API_BASE_URL}/friends/online`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  sendRequest: async (friendId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  acceptRequest: async (friendId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/accept`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  rejectRequest: async (friendId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ friendId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  removeFriend: async (friendId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(response);
  },

  blockUser: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/block`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId }),
    });
    return handleResponse<{ message: string }>(response);
  },

  getFriendshipStatus: async (friendId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/${friendId}/status`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },
};

export const reportsAPI = {
  submitReport: async (data: { reportedUserId: string; sessionId?: string; reason: string; description?: string }) => {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
  },

  getMyReports: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/my`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },
};

export const healthAPI = {
  getQueueStats: async () => {
    const response = await fetch(`${API_BASE_URL}/health/queue`);
    return handleResponse<any>(response);
  },

  getActiveUserCount: async () => {
    const response = await fetch(`${API_BASE_URL}/users/active-count`);
    return handleResponse<{ count: number }>(response);
  },
};

export default {
  auth:     authAPI,
  user:     userAPI,
  friends:  friendsAPI,
  reports:  reportsAPI,
  health:   healthAPI,
};
