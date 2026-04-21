// src/components/friends/FriendCard.tsx
import React, { useState } from 'react';

export type FriendStatus = 'online' | 'offline' | 'busy' | 'away';

export interface Friend {
  id: string;
  username: string;
  avatar?: string | null;
  status: FriendStatus;
  lastSeen?: Date;
  mutualFriends?: number;
  isBlocked?: boolean;
  chatSessionsCount?: number;
}

interface FriendCardProps {
  friend: Friend;
  variant?: 'default' | 'compact' | 'detailed';
  onStartChat?: (friend: Friend) => void;
  onRemoveFriend?: (friendId: string) => void;
  onBlockUser?: (friendId: string) => void;
  onUnblockUser?: (friendId: string) => void;
  onViewProfile?: (friendId: string) => void;
}

const statusConfig: Record<FriendStatus, { color: string; label: string; pulse: boolean }> = {
  online:  { color: 'bg-emerald-400',  label: 'Online',  pulse: true  },
  offline: { color: 'bg-text-disabled',     label: 'Offline', pulse: false },
  busy:    { color: 'bg-red-400',      label: 'Busy',    pulse: false },
  away:    { color: 'bg-amber-400',    label: 'Away',    pulse: false },
};

const getGradient = (name: string) => {
  const gradients = [
    'from-primary to-accent',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-600',
    'from-accent to-primary',
    'from-fuchsia-500 to-pink-600',
    'from-teal-500 to-cyan-600',
  ];
  return gradients[name.charCodeAt(0) % gradients.length];
};

const formatLastSeen = (date?: Date): string => {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const FriendCard: React.FC<FriendCardProps> = ({
  friend,
  variant = 'default',
  onStartChat,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onViewProfile,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = statusConfig[friend.status];
  const gradient = getGradient(friend.username);
  const initials = friend.username.slice(0, 2).toUpperCase();

  // COMPACT variant - for sidebar / small lists
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-bg-surface/90 transition-all duration-150 group cursor-pointer"
        onClick={() => onStartChat?.(friend)}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white overflow-hidden`}>
            {friend.avatar
              ? <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
              : initials
            }
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-primary ${status.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{friend.username}</p>
          <p className={`text-xs truncate ${friend.status === 'online' ? 'text-emerald-400' : 'text-text-secondary'}`}>
            {friend.status === 'online' ? 'Active now' : formatLastSeen(friend.lastSeen)}
          </p>
        </div>

        {/* Chat button on hover */}
        {onStartChat && friend.status !== 'offline' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartChat(friend); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary-hover/30 transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // DEFAULT & DETAILED variants
  return (
    <div className={`
      relative group
      bg-bg-secondary/80 hover:bg-bg-surface/90
      border border-border-subtle hover:border-border-default
      rounded-2xl transition-all duration-200
      ${variant === 'detailed' ? 'p-4' : 'p-3'}
      ${friend.isBlocked ? 'opacity-60' : ''}
    `}>
      <div className="flex items-center gap-3">

        {/* Avatar with status */}
        <div
          className="relative shrink-0 cursor-pointer"
          onClick={() => onViewProfile?.(friend.id)}
        >
          <div className={`
            ${variant === 'detailed' ? 'w-12 h-12' : 'w-10 h-10'}
            rounded-full bg-gradient-to-br ${gradient}
            flex items-center justify-center font-bold text-white overflow-hidden
            ${variant === 'detailed' ? 'text-base' : 'text-sm'}
          `}>
            {friend.avatar
              ? <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
              : initials
            }
          </div>

          {/* Status dot */}
          <div className={`absolute -bottom-0.5 -right-0.5 ${variant === 'detailed' ? 'w-3.5 h-3.5' : 'w-3 h-3'} rounded-full border-2 border-bg-primary ${status.color}`}>
            {status.pulse && (
              <div className={`absolute inset-0 rounded-full ${status.color} animate-ping opacity-75`} />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold text-text-primary truncate cursor-pointer hover:text-primary-hover transition-colors"
              onClick={() => onViewProfile?.(friend.id)}
            >
              {friend.username}
            </p>
            {friend.isBlocked && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium shrink-0">
                Blocked
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xs font-medium ${
              friend.status === 'online' ? 'text-emerald-400' :
              friend.status === 'busy' ? 'text-red-400' :
              friend.status === 'away' ? 'text-amber-400' :
              'text-text-secondary'
            }`}>
              {friend.status === 'online' ? 'Active now' : status.label}
            </span>
            {friend.status !== 'online' && friend.lastSeen && (
              <>
                <span className="text-text-disabled">·</span>
                <span className="text-xs text-text-disabled">{formatLastSeen(friend.lastSeen)}</span>
              </>
            )}
          </div>

          {/* Detailed: extra info */}
          {variant === 'detailed' && (
            <div className="flex items-center gap-3 mt-1.5">
              {friend.mutualFriends !== undefined && friend.mutualFriends > 0 && (
                <span className="text-xs text-text-secondary">
                  {friend.mutualFriends} mutual
                </span>
              )}
              {friend.chatSessionsCount !== undefined && (
                <span className="text-xs text-text-secondary">
                  {friend.chatSessionsCount} chats
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Chat button */}
          {!friend.isBlocked && onStartChat && (
            <button
              onClick={() => onStartChat(friend)}
              disabled={friend.status === 'offline'}
              className={`
                p-2 rounded-xl transition-all duration-150
                ${friend.status !== 'offline'
                  ? 'text-primary hover:bg-primary-hover/15 hover:text-primary-hover'
                  : 'text-text-disabled cursor-not-allowed'
                }
              `}
              title={friend.status === 'offline' ? 'User is offline' : 'Start chat'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setConfirmRemove(false); }}
              className="p-2 rounded-xl text-text-disabled hover:text-text-secondary hover:bg-bg-surface/90 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-20 bg-bg-surface/90 backdrop-blur-sm border border-border-default rounded-xl overflow-hidden shadow-xl w-44"
                onMouseLeave={() => { setShowMenu(false); setConfirmRemove(false); }}
              >
                {onViewProfile && (
                  <button
                    onClick={() => { onViewProfile(friend.id); setShowMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-text-secondary hover:bg-accent/20 hover:text-text-primary transition-colors text-left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    View Profile
                  </button>
                )}

                <div className="border-t border-border-default" />

                {/* Block/Unblock */}
                {friend.isBlocked ? (
                  onUnblockUser && (
                    <button
                      onClick={() => { onUnblockUser(friend.id); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Unblock User
                    </button>
                  )
                ) : (
                  onBlockUser && (
                    <button
                      onClick={() => { onBlockUser(friend.id); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Block User
                    </button>
                  )
                )}

                {/* Remove friend */}
                {onRemoveFriend && (
                  confirmRemove ? (
                    <div className="px-3 py-2.5 border-t border-border-default">
                      <p className="text-xs text-text-secondary mb-2">Remove {friend.username}?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmRemove(false)}
                          className="flex-1 py-1 text-xs rounded-lg bg-accent/20 text-text-secondary hover:bg-accent/30 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { onRemoveFriend(friend.id); setShowMenu(false); setConfirmRemove(false); }}
                          className="flex-1 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left border-t border-border-default"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm7-7l5 5m0-5l-5 5" />
                      </svg>
                      Remove Friend
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendCard;
