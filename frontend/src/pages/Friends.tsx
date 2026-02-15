// src/pages/Friends.tsx
import React from 'react';
import { FriendsList, Friend, FriendRequestData } from '../components/friends';

interface FriendsProps {
  friends?: Friend[];
  requests?: FriendRequestData[];
  isLoading?: boolean;
  onStartChat?: (friend: Friend) => void;
  onRemoveFriend?: (friendId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onCancelRequest?: (requestId: string) => void;
}

const Friends: React.FC<FriendsProps> = ({
  friends = [],
  requests = [],
  isLoading = false,
  onStartChat,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
}) => {
  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Friends</h1>
        <p className="text-gray-500">
          Manage your connections and friend requests
        </p>
      </div>

      {/* Friends list component */}
      <div className="h-[calc(100vh-220px)]">
        <FriendsList
          friends={friends}
          requests={requests}
          isLoading={isLoading}
          onStartChat={onStartChat}
          onRemoveFriend={onRemoveFriend}
          onBlockUser={onBlockUser}
          onUnblockUser={onUnblockUser}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          onCancelRequest={onCancelRequest}
        />
      </div>
    </div>
  );
};

export default Friends;
