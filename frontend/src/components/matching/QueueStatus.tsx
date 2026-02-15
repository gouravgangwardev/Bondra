// src/components/matching/QueueStatus.tsx
import React from 'react';

export type QueueType = 'video' | 'audio' | 'text';

export interface QueueStats {
  type: QueueType;
  usersInQueue: number;
  estimatedWaitTime: number; // seconds
  activeChats: number;
  averageWaitTime?: number; // seconds
}

interface QueueStatusProps {
  stats: QueueStats[];
  currentQueue?: QueueType | null;
  compact?: boolean;
}

const queueConfig: Record<QueueType, { 
  label: string; 
  icon: React.ReactNode; 
  gradient: string;
  iconBg: string;
}> = {
  video: {
    label: 'Video Chat',
    gradient: 'from-violet-500 to-indigo-600',
    iconBg: 'bg-violet-500/20',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
  },
  audio: {
    label: 'Voice Chat',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-500/20',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  text: {
    label: 'Text Chat',
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-cyan-500/20',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
};

const formatWaitTime = (seconds: number): string => {
  if (seconds < 5) return '< 5s';
  if (seconds < 60) return `~${Math.round(seconds / 5) * 5}s`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins}m`;
};

const QueueStatus: React.FC<QueueStatusProps> = ({
  stats,
  currentQueue,
  compact = false,
}) => {
  if (compact) {
    // Compact horizontal bar
    return (
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/60">
        {stats.map(stat => {
          const config = queueConfig[stat.type];
          const isCurrent = currentQueue === stat.type;
          
          return (
            <div
              key={stat.type}
              className={`flex items-center gap-2 transition-all duration-200 ${
                isCurrent ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center text-white shrink-0`}>
                <div className="w-4 h-4">{config.icon}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">{config.label}</p>
                <p className="text-xs text-gray-600">
                  {stat.usersInQueue} waiting · {formatWaitTime(stat.estimatedWaitTime)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Default: vertical cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map(stat => {
        const config = queueConfig[stat.type];
        const isCurrent = currentQueue === stat.type;
        const isPopular = stat.usersInQueue > 50;
        
        return (
          <div
            key={stat.type}
            className={`
              relative overflow-hidden
              rounded-2xl border transition-all duration-300
              ${isCurrent
                ? `bg-gradient-to-br ${config.gradient} bg-opacity-10 border-white/20 shadow-lg`
                : 'bg-gray-900/60 border-gray-800/60 hover:border-gray-700/60'
              }
            `}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />

            {/* Active indicator */}
            {isCurrent && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
              </div>
            )}

            {/* Popular badge */}
            {isPopular && !isCurrent && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">🔥 Popular</span>
              </div>
            )}

            <div className="relative p-5">
              {/* Icon */}
              <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center mb-4
                ${isCurrent ? 'bg-white/15 border border-white/20' : config.iconBg}
                ${isCurrent ? 'shadow-lg' : ''}
              `}>
                <div className={`w-6 h-6 ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                  {config.icon}
                </div>
              </div>

              {/* Label */}
              <h3 className={`text-sm font-bold mb-3 ${isCurrent ? 'text-white' : 'text-gray-200'}`}>
                {config.label}
              </h3>

              {/* Stats grid */}
              <div className="space-y-2.5">
                {/* Users in queue */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isCurrent ? 'text-white/70' : 'text-gray-500'}`}>
                    In Queue
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                    {stat.usersInQueue}
                  </span>
                </div>

                {/* Wait time */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isCurrent ? 'text-white/70' : 'text-gray-500'}`}>
                    Wait Time
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${
                    stat.estimatedWaitTime < 10 ? 'text-emerald-400' :
                    stat.estimatedWaitTime < 30 ? 'text-amber-400' :
                    'text-orange-400'
                  }`}>
                    {formatWaitTime(stat.estimatedWaitTime)}
                  </span>
                </div>

                {/* Active chats */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isCurrent ? 'text-white/70' : 'text-gray-500'}`}>
                    Active Chats
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                    {stat.activeChats}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className={`mt-4 h-1 rounded-full overflow-hidden ${isCurrent ? 'bg-white/20' : 'bg-gray-800/60'}`}>
                <div
                  className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                  style={{ width: `${Math.min((stat.usersInQueue / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QueueStatus;

