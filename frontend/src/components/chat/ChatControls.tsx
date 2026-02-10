// src/components/chat/ChatControls.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatControlsProps {
  onSendMessage: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  partnerTyping?: boolean;
  partnerName?: string;
  maxLength?: number;
  // For video/audio controls
  mode?: 'text' | 'video' | 'audio';
  isMuted?: boolean;
  isVideoOff?: boolean;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  onEndCall?: () => void;
  onSkip?: () => void;
}

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😮','😢','😡','👍','❤️','🔥','🎉','👏','💯'];

const ChatControls: React.FC<ChatControlsProps> = ({
  onSendMessage,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...',
  partnerTyping = false,
  partnerName = 'Stranger',
  maxLength = 1000,
  mode = 'text',
  isMuted = false,
  isVideoOff = false,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onSkip,
}) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > maxLength) return;
    setMessage(val);

    // Typing indicator
    if (!isTyping && val.length > 0) {
      setIsTyping(true);
      onTyping?.(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping?.(false);
    }, 1500);
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setMessage('');
    setIsTyping(false);
    onTyping?.(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    if (message.length < maxLength) {
      setMessage(prev => prev + emoji);
      textareaRef.current?.focus();
    }
    setShowEmoji(false);
  };

  const charPercent = (message.length / maxLength) * 100;
  const isNearLimit = message.length > maxLength * 0.85;

  return (
    <div className="flex flex-col gap-0">

      {/* Typing indicator */}
      <div className={`
        px-4 py-1.5 transition-all duration-300
        ${partnerTyping ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
      `}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gray-500"
                style={{
                  animation: 'typingBounce 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">{partnerName} is typing</span>
        </div>
        <style>{`
          @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
      </div>

      {/* Main controls bar */}
      <div className="px-3 pb-3">
        <div className={`
          flex items-end gap-2
          bg-gray-800/60 backdrop-blur-sm
          border border-gray-700/50 rounded-2xl
          p-2 transition-all duration-200
          focus-within:border-gray-600/70
          focus-within:bg-gray-800/80
        `}>

          {/* Emoji button */}
          <div className="relative shrink-0" ref={emojiRef}>
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              disabled={disabled}
              className={`
                p-2 rounded-xl transition-all duration-150
                ${showEmoji
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Emoji picker */}
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 z-20 bg-gray-900 border border-gray-700/60 rounded-2xl p-3 shadow-2xl">
                <div className="grid grid-cols-5 gap-1.5">
                  {EMOJI_LIST.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="text-xl p-1.5 rounded-lg hover:bg-gray-800 transition-colors hover:scale-110 transform duration-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Connecting...' : placeholder}
              rows={1}
              className={`
                w-full bg-transparent resize-none
                text-sm text-gray-100 placeholder-gray-600
                focus:outline-none leading-relaxed
                disabled:cursor-not-allowed disabled:opacity-50
                py-1.5 max-h-[120px] scrollbar-thin
              `}
              style={{ scrollbarWidth: 'none' }}
            />
            {/* Char counter */}
            {isNearLimit && (
              <div className="absolute right-0 bottom-0 flex items-center gap-1.5">
                {/* Circle progress */}
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="#374151" strokeWidth="2" />
                  <circle
                    cx="8" cy="8" r="6" fill="none"
                    stroke={charPercent > 95 ? '#ef4444' : '#8b5cf6'}
                    strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 6}`}
                    strokeDashoffset={`${2 * Math.PI * 6 * (1 - charPercent / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className={`text-[10px] font-mono ${charPercent > 95 ? 'text-red-400' : 'text-gray-500'}`}>
                  {maxLength - message.length}
                </span>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className={`
              shrink-0 p-2 rounded-xl transition-all duration-150
              ${message.trim() && !disabled
                ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30 hover:from-violet-400 hover:to-indigo-500 active:scale-95'
                : 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>

        {/* Video/Audio mode controls */}
        {(mode === 'video' || mode === 'audio') && (
          <div className="flex items-center justify-center gap-3 mt-3">
            {/* Mute */}
            <button
              onClick={onToggleMute}
              className={`
                p-3 rounded-2xl transition-all duration-150 active:scale-95
                ${isMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800/80 text-gray-300 border border-gray-700/50 hover:bg-gray-700/80'
                }
              `}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Video toggle (video mode only) */}
            {mode === 'video' && (
              <button
                onClick={onToggleVideo}
                className={`
                  p-3 rounded-2xl transition-all duration-150 active:scale-95
                  ${isVideoOff
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-800/80 text-gray-300 border border-gray-700/50 hover:bg-gray-700/80'
                  }
                `}
                title={isVideoOff ? 'Start Video' : 'Stop Video'}
              >
                {isVideoOff ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}

            {/* Skip */}
            {onSkip && (
              <button
                onClick={onSkip}
                className="p-3 rounded-2xl bg-gray-800/80 text-gray-300 border border-gray-700/50 hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/30 transition-all duration-150 active:scale-95"
                title="Skip to next"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* End call */}
            <button
              onClick={onEndCall}
              className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-150 active:scale-95"
              title="End call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>
        )}

        {/* Skip only (text mode) */}
        {mode === 'text' && onSkip && (
          <button
            onClick={onSkip}
            className="w-full mt-2 py-1.5 text-xs text-gray-600 hover:text-amber-400 transition-colors duration-150 flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Skip to next stranger
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatControls;
