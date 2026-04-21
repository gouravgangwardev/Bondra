// src/components/friends/FriendRequest.tsx
import React, { useState } from 'react';

export type RequestDirection = 'incoming' | 'outgoing';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FriendRequestData {
  id: string;
  userId: string;
  username: string;
  avatar?: string | null;
  direction: RequestDirection;
  status: RequestStatus;
  sentAt: Date;
  mutualFriends?: number;
  message?: string;
}

interface FriendRequestProps {
  request: FriendRequestData;
  onAccept?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  onViewProfile?: (userId: string) => void;
  isLoading?: boolean;
}

const getGradient = (name: string) => {
  const gradients = [
    'from-primary to-accent',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-600',
    'from-accent to-primary',
  ];
  return gradients[name.charCodeAt(0) % gradients.length];
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

const FriendRequest: React.FC<FriendRequestProps> = ({
  request,
  onAccept,
  onReject,
  onCancel,
  onViewProfile,
  isLoading = false,
}) => {
  const [actionTaken, setActionTaken] = useState<'accepted' | 'rejected' | 'cancelled' | null>(null);
  const gradient = getGradient(request.username);
  const initials = request.username.slice(0, 2).toUpperCase();

  const handleAccept = () => {
    setActionTaken('accepted');
    onAccept?.(request.id);
  };

  const handleReject = () => {
    setActionTaken('rejected');
    onReject?.(request.id);
  };

  const handleCancel = () => {
    setActionTaken('cancelled');
    onCancel?.(request.id);
  };

  // Resolved state (after action or from props)
  const resolvedStatus = actionTaken || (request.status !== 'pending' ? request.status : null);

  if (resolvedStatus) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-bg-secondary/80 border border-border-subtle opacity-60">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden`}>
          {request.avatar
            ? <img src={request.avatar} alt={request.username} className="w-full h-full object-cover" />
            : initials
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-secondary truncate">{request.username}</p>
          <p className={`text-xs mt-0.5 ${
            resolvedStatus === 'accepted' ? 'text-emerald-500' :
            resolvedStatus === 'rejected' ? 'text-red-500' :
            'text-text-disabled'
          }`}>
            {resolvedStatus === 'accepted' && '✓ Friend request accepted'}
            {resolvedStatus === 'rejected' && '✕ Request declined'}
            {resolvedStatus === 'cancelled' && '✕ Request cancelled'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-bg-secondary/80 border border-border-subtle hover:border-border-default transition-all duration-200">

      {/* Top row */}
      <div className="flex items-start gap-3">

        {/* Avatar */}
        <div
          className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all`}
          onClick={() => onViewProfile?.(request.userId)}
        >
          {request.avatar
            ? <img src={request.avatar} alt={request.username} className="w-full h-full object-cover" />
            : initials
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onViewProfile?.(request.userId)}
              className="text-sm font-semibold text-text-primary hover:text-primary-hover transition-colors truncate"
            >
              {request.username}
            </button>

            {/* Direction badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
              request.direction === 'incoming'
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'bg-accent/20 text-text-secondary border border-border-default/30'
            }`}>
              {request.direction === 'incoming' ? 'Wants to connect' : 'Request sent'}
            </span>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-text-secondary">{formatTimeAgo(request.sentAt)}</span>
            {request.mutualFriends !== undefined && request.mutualFriends > 0 && (
              <>
                <span className="text-text-disabled">·</span>
                <span className="text-xs text-text-secondary">
                  {request.mutualFriends} mutual {request.mutualFriends === 1 ? 'friend' : 'friends'}
                </span>
              </>
            )}
          </div>

          {/* Optional message */}
          {request.message && (
            <p className="text-xs text-text-secondary mt-1.5 italic bg-bg-surface/90 rounded-lg px-2.5 py-1.5 border border-border-default/30">
              "{request.message}"
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {request.direction === 'incoming' ? (
          <>
            {/* Accept */}
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-text-primary transition-all duration-150 shadow-md shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Accept
            </button>

            {/* Reject */}
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-bg-surface/90 hover:bg-accent/20 text-text-secondary border border-border-default hover:border-border-default transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Decline
            </button>
          </>
        ) : (
          /* Cancel outgoing request */
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-bg-surface/90 hover:bg-accent/20 text-text-secondary hover:text-text-primary border border-border-default hover:border-border-default transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Request
          </button>
        )}
      </div>
    </div>
  );
};

export default FriendRequest;
