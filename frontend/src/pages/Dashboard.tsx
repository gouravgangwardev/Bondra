// src/pages/Dashboard.tsx
import React from 'react';
import { MatchingScreen, QueueStats } from '../components/matching';
import { Friend } from '../components/friends/FriendCard';

interface DashboardProps {
  user?: { id: string; username: string; };
  queueStats?: QueueStats[];
  onlineFriends?: Friend[];
  onStartMatching?: () => void;
  onNavigate?: (route: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  queueStats = [],
  onlineFriends = [],
  onStartMatching,
  onNavigate,
}) => {
  // FIX Bug 15: Don't flash "Guest" while auth is still resolving.
  // user is undefined during load; show a neutral placeholder instead.
  const displayName = user?.username ?? '…';

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Welcome back, {displayName}! 👋
        </h1>
        <p className="text-text-secondary">
          {onlineFriends.length > 0
            ? `${onlineFriends.length} of your friends are online`
            : 'Start chatting to meet new people'}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => onNavigate?.('/chat')}
          className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-primary/30 hover:border-primary/50 transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="font-bold text-text-primary mb-1">Start Chat</h3>
          <p className="text-sm text-text-secondary">Meet someone new</p>
        </button>

        <button
          onClick={() => onNavigate?.('/friends')}
          className="p-6 rounded-2xl bg-bg-secondary/80 border border-border-subtle hover:border-border-default transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-text-primary mb-1">Friends</h3>
          <p className="text-sm text-text-secondary">{onlineFriends.length} online</p>
        </button>

        <button
          onClick={() => onNavigate?.('/profile')}
          className="p-6 rounded-2xl bg-bg-secondary/80 border border-border-subtle hover:border-border-default transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="font-bold text-text-primary mb-1">Profile</h3>
          <p className="text-sm text-text-secondary">View & edit</p>
        </button>
      </div>

      {/* Main matching component */}
      <MatchingScreen
        state="idle"
        queueStats={queueStats}
        onSelectMode={(mode) => onNavigate?.(`/chat?mode=${mode}`)}
        onStartSearch={() => onNavigate?.('/chat')}
      />
    </div>
  );
};

export default Dashboard;
