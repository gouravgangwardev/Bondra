// src/services/api.ts

const API_BASE_URL = process.env.REACT_APP_ || 'http://localhost:3000/api/v1';

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
  getProfile: async () => {
    const response = await fetch(`${API_BASE_URL}/users/me`, { headers: getAuthHeaders() });
    return handleResponse<any>(response);
  },

  updateProfile: async (data: { username?: string; bio?: string }) => {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: 'PATCH',
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
};

export const friendsAPI = {
  getFriends: async () => {
    const response = await fetch(`${API_BASE_URL}/friends`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  getRequests: async () => {
    const response = await fetch(`${API_BASE_URL}/friends/requests`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  sendRequest: async (userId: string, message?: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/requests`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, message }),
    });
    return handleResponse<{ requestId: string }>(response);
  },

  acceptRequest: async (requestId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/accept`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(response);
  },

  rejectRequest: async (requestId: string) => {
    const response = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
};

export const chatAPI = {
  getQueueStats: async () => {
    const response = await fetch(`${API_BASE_URL}/chat/queue-stats`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
  },

  reportUser: async (data: { reportedUserId: string; sessionId: string; reason: string }) => {
    const response = await fetch(`${API_BASE_URL}/chat/report`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
  },
};

export default {
  auth: authAPI,
  user: userAPI,
  friends: friendsAPI,
  chat: chatAPI,
};
