import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ChatControlsProps {
  onSendMessage?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onSkip?: () => void;

  onEndChat?: () => void;   
  onEndCall?: () => void;   

  disabled?: boolean;
  placeholder?: string;
  partnerName?: string;
  isPartnerTyping?: boolean;

  isMuted?: boolean;
  isVideoOff?: boolean;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
}


const EMOJI_LIST = [
  '😊','😂','❤️','🔥','👍','😎','🎉','😮',
  '🥺','😴','🤔','👏','💯','✨','🙏','😅'
];

const ChatControls: React.FC<ChatControlsProps> = ({
  onSendMessage,
  onTyping,
  onSkip,
  onEndChat,
  disabled = false,
  placeholder = 'Type a message...',
  partnerName = 'Stranger',
  isPartnerTyping = false,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
}) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const emojiRef = useRef<HTMLDivElement>(null);

  /* ---------------- AUTO RESIZE ---------------- */

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [message]);

  /* ---------------- CLOSE EMOJI ON OUTSIDE CLICK ---------------- */

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ---------------- TYPING HANDLER ---------------- */

  const handleTyping = useCallback(
    (value: string) => {
      setMessage(value);

      if (!isTyping && value.length > 0) {
        setIsTyping(true);
        onTyping?.(true);
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping?.(false);
      }, 1500);

      if (value.length === 0) {
        setIsTyping(false);
        onTyping?.(false);
      }
    },
    [isTyping, onTyping]
  );

  /* ---------------- SEND ---------------- */

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSendMessage?.(trimmed);
    setMessage('');
    setIsTyping(false);
    onTyping?.(false);
    clearTimeout(typingTimeoutRef.current);
    inputRef.current?.focus();
  }, [message, disabled, onSendMessage, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const canSend = message.trim().length > 0 && !disabled;

  /* ============================================================= */

  return (
    <div className="flex flex-col gap-0">

      {/* Typing indicator (only in text mode) */}
      {onSendMessage && (
        <div
          className={`px-4 py-1.5 transition-all duration-300 ${
            isPartnerTyping
              ? 'opacity-100 h-7'
              : 'opacity-0 h-0 overflow-hidden'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  style={{
                    animation: 'typingBounce 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {partnerName} is typing...
            </span>
          </div>

          <style>{`
            @keyframes typingBounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-4px); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ================= TEXT MODE ================= */}
      {onSendMessage && (
        <div className="px-3 pb-3">
          <div
            className={`flex items-end gap-2 p-2 rounded-2xl bg-gray-800/60 backdrop-blur-sm border transition-all duration-200
              ${
                disabled
                  ? 'border-gray-700/30 opacity-60'
                  : 'border-gray-700/60 focus-within:border-violet-500/50 focus-within:bg-gray-800/80'
              }`}
          >
            {/* Emoji */}
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                disabled={disabled}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 disabled:opacity-40"
              >
                😊
              </button>

              {showEmoji && (
                <div className="absolute bottom-full left-0 mb-2 z-30 bg-gray-800 border border-gray-700 rounded-2xl p-3 w-52">
                  <div className="grid grid-cols-4 gap-1">
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="text-xl p-1.5 rounded-lg hover:bg-gray-700"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <textarea
              ref={inputRef}
              value={message}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Chat ended' : placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none min-h-[36px] max-h-[120px] py-2"
            />

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`p-2 rounded-xl transition-all ${
                canSend
                  ? 'bg-violet-600 text-white hover:bg-violet-500'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ================= MEDIA CONTROLS MODE ================= */}
      {!onSendMessage && (
        <div className="flex justify-center gap-3 p-3 bg-gray-900">
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              disabled={disabled}
              className="px-4 py-2 bg-gray-800 rounded text-white"
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          )}

          {onToggleVideo && (
            <button
              onClick={onToggleVideo}
              disabled={disabled}
              className="px-4 py-2 bg-gray-800 rounded text-white"
            >
              {isVideoOff ? 'Start Video' : 'Stop Video'}
            </button>
          )}

          {onSkip && (
            <button
              onClick={onSkip}
              disabled={disabled}
              className="px-4 py-2 bg-yellow-600 rounded text-white"
            >
              Skip
            </button>
          )}

          {onEndChat && (
            <button
              onClick={onEndChat}
              className="px-4 py-2 bg-red-600 rounded text-white"
            >
              End
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatControls;
