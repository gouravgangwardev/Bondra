// src/components/layout/Sidebar.tsx
import React from 'react';
import FriendCard, { Friend } from '../friends/FriendCard';

interface SidebarProps {
  currentRoute?: string;
  friends?: Friend[];
  onNavigate?: (route: string) => void;
  onStartChat?: (friend: Friend) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  badge?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentRoute = '/',
  friends = [],
  onNavigate,
  onStartChat,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      route: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'chat',
      label: 'Start Chat',
      route: '/chat',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Friends',
      route: '/friends',
      badge: friends.filter(f => !f.isBlocked).length,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'discover',
      label: 'Discover',
      route: '/discover',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
  ];

  const onlineFriends = friends.filter(f => f.status === 'online' && !f.isBlocked);

  if (isCollapsed) {
    return (
      <aside className="w-20 border-r border-border-subtle bg-bg-primary flex flex-col shrink-0">
        {/* Toggle */}
        <button
          onClick={onToggleCollapse}
          className="p-6 text-text-secondary hover:text-text-secondary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        {/* Nav icons */}
        <nav className="flex-1 px-3 space-y-2">
          {navItems.map(item => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.route)}
                className={`
                  relative w-full p-3 rounded-xl transition-all
                  ${isActive
                    ? 'bg-primary/20 text-primary shadow-lg shadow-violet-500/10'
                    : 'text-text-secondary hover:text-text-secondary hover:bg-bg-surface/90'
                  }
                `}
                title={item.label}
              >
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-text-primary text-[9px] font-bold flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-r border-border-subtle bg-bg-primary flex flex-col shrink-0">
      
      {/* Header */}
      <div className="px-4 py-6 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Navigation</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-secondary hover:bg-bg-surface/90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive = currentRoute === item.route;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.route)}
              className={`
                relative w-full flex items-center gap-3 px-4 py-3 rounded-xl
                text-sm font-medium transition-all
                ${isActive
                  ? 'bg-primary/20 text-primary shadow-lg shadow-violet-500/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/90'
                }
              `}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`
                  text-xs font-bold px-2 py-0.5 rounded-full
                  ${isActive ? 'bg-primary text-text-primary' : 'bg-accent/20 text-text-secondary'}
                `}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Online friends section */}
      {onlineFriends.length > 0 && (
        <>
          <div className="px-4 py-3 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Online · {onlineFriends.length}
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ECEAE4 transparent' }}>
            {onlineFriends.slice(0, 10).map(friend => (
              <FriendCard
                key={friend.id}
                friend={friend}
                variant="compact"
                onStartChat={onStartChat}
              />
            ))}
            {onlineFriends.length > 10 && (
              <button
                onClick={() => onNavigate?.('/friends')}
                className="w-full text-xs text-text-secondary hover:text-text-secondary py-2 text-center transition-colors"
              >
                View all {onlineFriends.length} online friends
              </button>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {onlineFriends.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="text-center max-w-[200px]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-bg-surface/90 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-xs text-text-disabled leading-relaxed">
              No friends online right now. Start chatting to make new friends!
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
