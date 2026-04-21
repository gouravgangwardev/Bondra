// src/components/friends/FriendsList.tsx
import React, { useState, useMemo } from 'react';
import FriendCard, { Friend } from './FriendCard';
import FriendRequest, { FriendRequestData } from './FriendRequest';

type TabType = 'all' | 'online' | 'requests' | 'blocked';

interface FriendsListProps {
  friends: Friend[];
  requests?: FriendRequestData[];
  isLoading?: boolean;
  onStartChat?: (friend: Friend) => void;
  onRemoveFriend?: (friendId: string) => void;
  onBlockUser?: (friendId: string) => void;
  onUnblockUser?: (friendId: string) => void;
  onViewProfile?: (userId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onCancelRequest?: (requestId: string) => void;
  onAddFriend?: () => void;
}

const SkeletonCard = () => (
  <div className="flex items-center gap-3 p-3 rounded-2xl bg-bg-secondary/80 border border-border-subtle animate-pulse">
    <div className="w-10 h-10 rounded-full bg-bg-surface/90 shrink-0" />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-3 bg-bg-surface/90 rounded-lg w-2/5" />
      <div className="h-2.5 bg-bg-surface/90 rounded-lg w-1/3" />
    </div>
    <div className="w-8 h-8 rounded-xl bg-bg-surface/90" />
  </div>
);

const EmptyState: React.FC<{ tab: TabType; onAddFriend?: () => void }> = ({ tab, onAddFriend }) => {
  const config = {
    all: {
      icon: (
        <svg className="w-8 h-8 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'No friends yet',
      desc: 'Start chatting with strangers and add them as friends!',
      action: true,
    },
    online: {
      icon: (
        <svg className="w-8 h-8 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 9v3m0 0v3m0-3h3m-3 0H9" />
        </svg>
      ),
      title: 'No friends online',
      desc: 'All your friends are currently offline.',
      action: false,
    },
    requests: {
      icon: (
        <svg className="w-8 h-8 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      title: 'No pending requests',
      desc: 'You have no incoming or outgoing friend requests.',
      action: false,
    },
    blocked: {
      icon: (
        <svg className="w-8 h-8 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      title: 'No blocked users',
      desc: "You haven't blocked anyone.",
      action: false,
    },
  };

  const c = config[tab];
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-surface/90 border border-border-default/30 flex items-center justify-center">
        {c.icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-text-secondary">{c.title}</p>
        <p className="text-xs text-text-disabled mt-1 max-w-[200px] mx-auto leading-relaxed">{c.desc}</p>
      </div>
      {c.action && onAddFriend && (
        <button
          onClick={onAddFriend}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary/15 text-primary border border-primary/25 hover:bg-primary-hover/25 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Find People to Chat
        </button>
      )}
    </div>
  );
};

const FriendsList: React.FC<FriendsListProps> = ({
  friends,
  requests = [],
  isLoading = false,
  onStartChat,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onViewProfile,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
  onAddFriend,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');

  // Counts
  const onlineCount = friends.filter(f => f.status === 'online' && !f.isBlocked).length;
  const pendingCount = requests.filter(r => r.status === 'pending' && r.direction === 'incoming').length;
  const blockedCount = friends.filter(f => f.isBlocked).length;

  // Filtered lists
  const filteredFriends = useMemo(() => {
    let list = friends;

    if (activeTab === 'online') list = friends.filter(f => f.status === 'online' && !f.isBlocked);
    else if (activeTab === 'all') list = friends.filter(f => !f.isBlocked);
    else if (activeTab === 'blocked') list = friends.filter(f => f.isBlocked);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => f.username.toLowerCase().includes(q));
    }

    // Sort: online first, then alphabetical
    return [...list].sort((a, b) => {
      const order = { online: 0, away: 1, busy: 2, offline: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.username.localeCompare(b.username);
    });
  }, [friends, activeTab, search]);

  const filteredRequests = useMemo(() => {
    if (activeTab !== 'requests') return [];
    if (!search.trim()) return requests.filter(r => r.status === 'pending');
    const q = search.toLowerCase();
    return requests.filter(r => r.status === 'pending' && r.username.toLowerCase().includes(q));
  }, [requests, activeTab, search]);

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'all',      label: 'All',      count: friends.filter(f => !f.isBlocked).length },
    { id: 'online',   label: 'Online',   count: onlineCount },
    { id: 'requests', label: 'Requests', count: pendingCount > 0 ? pendingCount : undefined },
    { id: 'blocked',  label: 'Blocked',  count: blockedCount > 0 ? blockedCount : undefined },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-primary rounded-2xl border border-border-subtle overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle bg-bg-secondary/80 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary tracking-tight">Friends</h2>
          {onAddFriend && (
            <button
              onClick={onAddFriend}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary/15 text-primary border border-primary/25 hover:bg-primary-hover/25 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Friend
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="w-full bg-bg-surface/90 border border-border-default rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary/50 focus:bg-bg-surface/90 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-secondary">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                transition-all duration-150
                ${activeTab === tab.id
                  ? 'bg-primary/20 text-primary-hover border border-primary/30'
                  : 'text-text-secondary hover:text-text-secondary hover:bg-bg-surface/90'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center
                  ${activeTab === tab.id
                    ? tab.id === 'requests' ? 'bg-primary text-text-primary' : 'bg-primary/30 text-primary-hover'
                    : tab.id === 'requests' ? 'bg-red-500 text-text-primary' : 'bg-accent/30 text-text-secondary'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ECEAE4 transparent' }}>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activeTab === 'requests' ? (
          filteredRequests.length === 0 ? (
            <EmptyState tab="requests" onAddFriend={onAddFriend} />
          ) : (
            <>
              {/* Incoming requests */}
              {filteredRequests.filter(r => r.direction === 'incoming').length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-1 mb-2">
                    Incoming · {filteredRequests.filter(r => r.direction === 'incoming').length}
                  </p>
                  <div className="space-y-2">
                    {filteredRequests.filter(r => r.direction === 'incoming').map(req => (
                      <FriendRequest
                        key={req.id}
                        request={req}
                        onAccept={onAcceptRequest}
                        onReject={onRejectRequest}
                        onViewProfile={onViewProfile}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* Outgoing requests */}
              {filteredRequests.filter(r => r.direction === 'outgoing').length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-1 mb-2">
                    Sent · {filteredRequests.filter(r => r.direction === 'outgoing').length}
                  </p>
                  <div className="space-y-2">
                    {filteredRequests.filter(r => r.direction === 'outgoing').map(req => (
                      <FriendRequest
                        key={req.id}
                        request={req}
                        onCancel={onCancelRequest}
                        onViewProfile={onViewProfile}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        ) : filteredFriends.length === 0 ? (
          <EmptyState tab={activeTab} onAddFriend={onAddFriend} />
        ) : (
          <>
            {/* Online section header */}
            {activeTab === 'all' && onlineCount > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-1 pb-1">
                Online · {onlineCount}
              </p>
            )}

            {filteredFriends.map(friend => (
              <FriendCard
                key={friend.id}
                friend={friend}
                variant="default"
                onStartChat={onStartChat}
                onRemoveFriend={onRemoveFriend}
                onBlockUser={onBlockUser}
                onUnblockUser={onUnblockUser}
                onViewProfile={onViewProfile}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer stats */}
      {!isLoading && activeTab !== 'requests' && (
        <div className="px-4 py-2.5 border-t border-border-subtle bg-bg-secondary/30 shrink-0">
          <p className="text-xs text-text-disabled text-center">
            {onlineCount} online · {friends.filter(f => !f.isBlocked).length} total friends
          </p>
        </div>
      )}
    </div>
  );
};

export default FriendsList;
