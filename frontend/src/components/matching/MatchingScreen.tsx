// src/components/matching/MatchingScreen.tsx
import React, { useState, useEffect } from 'react';
import QueueStatus, { QueueType, QueueStats } from './QueueStatus';

export type MatchingState = 'idle' | 'selecting' | 'searching' | 'matched' | 'failed';

export interface MatchingScreenProps {
  state: MatchingState;
  selectedMode?: QueueType;
  queueStats?: QueueStats[];
  waitTime?: number; // seconds elapsed
  estimatedWaitTime?: number;
  matchedUser?: {
    username: string;
    avatar?: string;
  };
  onSelectMode?: (mode: QueueType) => void;
  onStartSearch?: () => void;
  onCancelSearch?: () => void;
  onAcceptMatch?: () => void;
  onSkipMatch?: () => void;
}

const modeOptions: Array<{
  type: QueueType;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}> = [
  {
    type: 'video',
    label: 'Video Chat',
    description: 'Face-to-face with camera',
    gradient: 'from-violet-500 to-indigo-600',
    iconBg: 'bg-violet-500/15',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
  },
  {
    type: 'audio',
    label: 'Voice Chat',
    description: 'Talk with microphone only',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-500/15',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text Chat',
    description: 'Message-based conversation',
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-cyan-500/15',
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

const formatWaitTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MatchingScreen: React.FC<MatchingScreenProps> = ({
  state,
  selectedMode,
  queueStats,
  waitTime = 0,
  estimatedWaitTime,
  matchedUser,
  onSelectMode,
  onStartSearch,
  onCancelSearch,
  onAcceptMatch,
  onSkipMatch,
}) => {
  const [pulsePhase, setPulsePhase] = useState(0);

  // Pulsing animation for searching state
  useEffect(() => {
    if (state === 'searching') {
      const interval = setInterval(() => {
        setPulsePhase(p => (p + 1) % 3);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [state]);

  // IDLE / SELECTING - Choose chat mode
  if (state === 'idle' || state === 'selecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gray-950 rounded-2xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Meet Someone New</h2>
          <p className="text-sm text-gray-500">Choose how you want to chat</p>
        </div>

        {/* Mode selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 w-full max-w-3xl">
          {modeOptions.map(mode => {
            const isSelected = selectedMode === mode.type;
            return (
              <button
                key={mode.type}
                onClick={() => onSelectMode?.(mode.type)}
                className={`
                  relative group p-6 rounded-2xl border-2 transition-all duration-200
                  ${isSelected
                    ? `bg-gradient-to-br ${mode.gradient} border-transparent shadow-xl`
                    : 'bg-gray-900/60 border-gray-800/60 hover:border-gray-700/80 hover:bg-gray-800/60'
                  }
                `}
              >
                {/* Background shimmer on hover */}
                {!isSelected && (
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                )}

                <div className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto
                  ${isSelected ? 'bg-white/20' : mode.iconBg}
                `}>
                  <div className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                    {mode.icon}
                  </div>
                </div>

                <h3 className={`font-semibold text-sm mb-1 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                  {mode.label}
                </h3>
                <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-600'}`}>
                  {mode.description}
                </p>

                {/* Checkmark */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        {queueStats && <QueueStatus stats={queueStats} currentQueue={selectedMode} />}

        {/* Start button */}
        <button
          onClick={onStartSearch}
          disabled={!selectedMode}
          className={`
            mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base
            transition-all duration-200 shadow-xl
            ${selectedMode
              ? 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white shadow-violet-500/40 active:scale-95'
              : 'bg-gray-800/60 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Start Matching
        </button>
      </div>
    );
  }

  // SEARCHING - Finding match
  if (state === 'searching') {
    const selectedConfig = modeOptions.find(m => m.type === selectedMode);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gray-950 rounded-2xl relative overflow-hidden">
        
        {/* Animated background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`absolute w-64 h-64 rounded-full border-2 ${
                selectedConfig ? `border-${selectedConfig.gradient.split('-')[1]}-500/20` : 'border-violet-500/20'
              }`}
              style={{
                animation: `ping 2s ease-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center">
          
          {/* Pulsing icon */}
          <div className="relative mb-8">
            <div className={`
              w-24 h-24 rounded-3xl flex items-center justify-center
              bg-gradient-to-br ${selectedConfig?.gradient || 'from-violet-500 to-indigo-600'}
              shadow-2xl
            `}>
              <div className="w-12 h-12 text-white">{selectedConfig?.icon}</div>
            </div>

            {/* Orbiting dots */}
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2"
                style={{
                  animation: 'spin 3s linear infinite',
                  animationDelay: `${i * 1}s`,
                  transformOrigin: `60px center`,
                }}
              >
                <div className={`w-3 h-3 rounded-full bg-white ${pulsePhase === i ? 'scale-125' : 'scale-100'} transition-transform duration-300`} />
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Finding a match...</h2>
          <p className="text-sm text-gray-500 mb-6">
            {selectedConfig?.label} · {formatWaitTime(waitTime)} elapsed
          </p>

          {/* Progress bar */}
          <div className="w-64 h-2 bg-gray-800/60 rounded-full overflow-hidden mb-8">
            <div
              className={`h-full bg-gradient-to-r ${selectedConfig?.gradient || 'from-violet-500 to-indigo-600'}`}
              style={{
                width: estimatedWaitTime ? `${Math.min((waitTime / estimatedWaitTime) * 100, 100)}%` : '30%',
                transition: 'width 1s linear',
              }}
            />
          </div>

          {/* Tips */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4 max-w-md mb-6">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              💡 <strong className="text-gray-300">Tip:</strong> Be friendly and respectful. You can skip or report users who violate our community guidelines.
            </p>
          </div>

          {/* Cancel button */}
          <button
            onClick={onCancelSearch}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-gray-200 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700/60 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Search
          </button>
        </div>

        <style>{`
          @keyframes ping {
            0% { transform: scale(1); opacity: 0.8; }
            75%, 100% { transform: scale(2.5); opacity: 0; }
          }
          @keyframes spin {
            from { transform: rotate(0deg) translateX(60px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
          }
        `}</style>
      </div>
    );
  }

  // MATCHED - Found someone!
  if (state === 'matched' && matchedUser) {
    const selectedConfig = modeOptions.find(m => m.type === selectedMode);
    const gradient = selectedConfig?.gradient || 'from-violet-500 to-purple-600';
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gray-950 rounded-2xl relative overflow-hidden">
        
        {/* Success burst effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-gradient-to-br from-emerald-500/20 to-transparent animate-ping" style={{ animationDuration: '1.5s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          
          {/* Success icon */}
          <div className="relative mb-6">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl`}>
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* Checkmark ring */}
            <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 scale-110" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Match Found! 🎉</h2>
          <p className="text-sm text-gray-500 mb-8">Get ready to chat</p>

          {/* Matched user */}
          <div className="flex items-center gap-4 mb-8 p-5 bg-gray-900/60 border border-gray-800/60 rounded-2xl">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl font-bold text-white overflow-hidden`}>
              {matchedUser.avatar
                ? <img src={matchedUser.avatar} alt={matchedUser.username} className="w-full h-full object-cover" />
                : matchedUser.username[0].toUpperCase()
              }
            </div>
            <div>
              <p className="text-base font-semibold text-gray-100">{matchedUser.username}</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedConfig?.label}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onAcceptMatch}
              className={`
                flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-base
                bg-gradient-to-r ${gradient} hover:opacity-90 text-white
                shadow-xl transition-all active:scale-95
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Start Chatting
            </button>

            {onSkipMatch && (
              <button
                onClick={onSkipMatch}
                className="flex items-center gap-2 px-6 py-4 rounded-2xl font-semibold text-sm text-gray-400 hover:text-gray-200 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700/60 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // FAILED - No match found
  if (state === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gray-950 rounded-2xl">
        <div className="w-20 h-20 rounded-3xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-100 mb-2">No Match Found</h2>
        <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
          We couldn't find a match this time. Try again or choose a different chat mode.
        </p>
        <button
          onClick={onStartSearch}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-violet-500/15 text-violet-400 border border-violet-500/25 hover:bg-violet-500/25 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    );
  }

  return null;
};

export default MatchingScreen;
