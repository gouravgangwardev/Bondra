// src/components/layout/Navbar.tsx
import React, { useState } from 'react';

export interface User {
  id: string;
  username: string;
  avatar?: string | null;
  isGuest?: boolean;
}

interface NavbarProps {
  user?: User | null;
  onlineCount?: number;
  unreadNotifications?: number;
  onNavigate?: (route: string) => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  user,
  onlineCount = 0,
  unreadNotifications = 0,
  onNavigate,
  onLogout,
  onOpenSettings,
  onOpenProfile,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const getGradient = (name: string) => {
    const gradients = [
      'from-primary to-accent',
      'from-cyan-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-500',
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  };

  return (
    <nav className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-sm border-b border-border-subtle">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <button
              onClick={() => onNavigate?.('/')}
              className="flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/15 group-hover:shadow-primary/25 transition-all">
                <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-text-primary hidden sm:block">RandomChat</span>
            </button>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => onNavigate?.('/chat')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-all"
              >
                Chat
              </button>
              <button
                onClick={() => onNavigate?.('/friends')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-all"
              >
                Friends
              </button>
              <button
                onClick={() => onNavigate?.('/discover')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-all"
              >
                Discover
              </button>
            </div>
          </div>

          {/* Right: Stats + Actions */}
          <div className="flex items-center gap-3">

            {/* Online count */}
            {onlineCount > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                  {onlineCount.toLocaleString()} online
                </span>
              </div>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-bg-primary">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-bg-secondary/80 backdrop-blur-sm border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
                  onMouseLeave={() => setShowNotifications(false)}
                >
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <p className="text-sm font-semibold text-text-primary">Notifications</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {unreadNotifications === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-text-secondary">No new notifications</p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        <div className="px-3 py-2.5 rounded-xl hover:bg-bg-surface/90 transition-colors cursor-pointer">
                          <p className="text-xs text-text-secondary">
                            <strong className="text-primary">Alex_2024</strong> sent you a friend request
                          </p>
                          <p className="text-xs text-text-disabled mt-0.5">2 minutes ago</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-bg-surface/90 transition-all"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(user.username)} flex items-center justify-center text-xs font-bold text-white overflow-hidden`}>
                    {user.avatar
                      ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                      : user.username[0].toUpperCase()
                    }
                  </div>
                  <span className="text-sm font-medium text-text-secondary hidden sm:block">{user.username}</span>
                  {user.isGuest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-text-secondary font-semibold hidden sm:block">GUEST</span>
                  )}
                  <svg className="w-4 h-4 text-text-secondary hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User dropdown */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 bg-bg-secondary/80 backdrop-blur-sm border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-3 border-b border-border-subtle">
                      <p className="text-sm font-semibold text-text-primary truncate">{user.username}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{user.isGuest ? 'Guest Account' : 'Premium Member'}</p>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={() => { onOpenProfile?.(); setShowUserMenu(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </button>

                      <button
                        onClick={() => { onOpenSettings?.(); setShowUserMenu(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>

                      <div className="my-2 border-t border-border-subtle" />

                      <button
                        onClick={() => { onLogout?.(); setShowUserMenu(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onNavigate?.('/login')}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-text-primary transition-all shadow-lg shadow-primary/15"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
