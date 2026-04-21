// src/hooks/useFriends.ts
// Missing hook — provides fetched friend data to Friends page and Dashboard.
// Normalises the backend IFriendship rows into the Friend/FriendRequestData
// shapes that FriendCard and FriendRequest components expect.

import { useState, useEffect, useCallback } from 'react';
import { friendsAPI } from '../services/api';
import type { Friend } from '../components/friends/FriendCard';
import type { FriendRequestData } from '../components/friends/FriendRequest';

interface UseFriendsReturn {
  friends:         Friend[];
  pendingRequests: FriendRequestData[];
  sentRequests:    FriendRequestData[];
  onlineFriends:   Friend[];
  isLoading:       boolean;
  error:           string | null;
  refetch:         () => Promise<void>;
  sendRequest:     (friendId: string) => Promise<void>;
  acceptRequest:   (friendId: string) => Promise<void>;
  rejectRequest:   (friendId: string) => Promise<void>;
  removeFriend:    (friendId: string) => Promise<void>;
  blockUser:       (userId: string)   => Promise<void>;
}

// Normalise a raw backend friendship row into the Friend component shape.
// Backend rows have: id, user_id, friend_id, username, avatar_url, status, last_seen
function toFriend(raw: any, currentUserId?: string): Friend {
  return {
    id:           raw.friend_id ?? raw.id ?? raw.userId ?? '',
    username:     raw.username  ?? raw.friend_username ?? 'Unknown',
    avatar:       raw.avatar_url ?? raw.avatar ?? null,
    status:       raw.status === 'online' ? 'online'
                : raw.status === 'in_call' ? 'busy'
                : raw.status === 'away'    ? 'away'
                : 'offline',
    lastSeen:     raw.last_seen ? new Date(raw.last_seen) : undefined,
    isBlocked:    raw.is_blocked ?? false,
    mutualFriends: raw.mutual_friends ?? 0,
    chatSessionsCount: raw.chat_sessions_count ?? 0,
  };
}

// Normalise a raw pending/sent request row into FriendRequestData shape.
function toRequest(raw: any, direction: 'incoming' | 'outgoing'): FriendRequestData {
  return {
    id:           raw.id ?? raw.friendship_id ?? '',
    userId:       raw.user_id ?? raw.friend_id ?? raw.userId ?? '',
    username:     raw.username ?? raw.requester_username ?? 'Unknown',
    avatar:       raw.avatar_url ?? null,
    direction,
    status:       'pending',
    sentAt:       raw.created_at ? new Date(raw.created_at) : new Date(),
    mutualFriends: raw.mutual_friends ?? 0,
  };
}

export const useFriends = (currentUserId?: string): UseFriendsReturn => {
  const [friends,         setFriends]         = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestData[]>([]);
  const [sentRequests,    setSentRequests]    = useState<FriendRequestData[]>([]);
  const [onlineFriends,   setOnlineFriends]   = useState<Friend[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [rawFriends, rawPending, rawSent, rawOnline] = await Promise.all([
        friendsAPI.getFriends().catch(() => []),
        friendsAPI.getPendingRequests().catch(() => []),
        friendsAPI.getSentRequests().catch(() => []),
        friendsAPI.getOnlineFriends().catch(() => []),
      ]);

      setFriends(rawFriends.map(r => toFriend(r, currentUserId)));
      setPendingRequests(rawPending.map(r => toRequest(r, 'incoming')));
      setSentRequests(rawSent.map(r => toRequest(r, 'outgoing')));
      setOnlineFriends(rawOnline.map(r => toFriend(r, currentUserId)));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load friends');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const sendRequest = useCallback(async (friendId: string) => {
    await friendsAPI.sendRequest(friendId);
    await fetchAll();
  }, [fetchAll]);

  const acceptRequest = useCallback(async (friendId: string) => {
    await friendsAPI.acceptRequest(friendId);
    await fetchAll();
  }, [fetchAll]);

  const rejectRequest = useCallback(async (friendId: string) => {
    await friendsAPI.rejectRequest(friendId);
    await fetchAll();
  }, [fetchAll]);

  const removeFriend = useCallback(async (friendId: string) => {
    await friendsAPI.removeFriend(friendId);
    await fetchAll();
  }, [fetchAll]);

  const blockUser = useCallback(async (userId: string) => {
    await friendsAPI.blockUser(userId);
    await fetchAll();
  }, [fetchAll]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    onlineFriends,
    isLoading,
    error,
    refetch:      fetchAll,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    blockUser,
  };
};

export default useFriends;
