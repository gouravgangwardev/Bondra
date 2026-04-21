// src/components/chat/MessageBubble.tsx
import React, { useState } from 'react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  status?: MessageStatus;
  type?: 'text' | 'system' | 'emoji';
  reactions?: Record<string, number>;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
  onReport?: (messageId: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const StatusIcon: React.FC<{ status: MessageStatus }> = ({ status }) => {
  if (status === 'sending') return (
    <svg className="w-3 h-3 animate-spin text-text-secondary" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
  if (status === 'failed') return (
    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
  if (status === 'read') return (
    <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l4 4 9-9M4 9l4 4 9-9" />
    </svg>
  );
  return (
    <svg className="w-3 h-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = true,
  onReact,
  onReport,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // System message
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1 rounded-full text-xs text-text-secondary bg-bg-surface/50 border border-border-default">
          {message.content}
        </span>
      </div>
    );
  }

  const isEmoji = message.type === 'emoji' ||
    (/^\p{Emoji}+$/u.test(message.content) && message.content.length <= 8);

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`flex items-end gap-2 group mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseLeave={() => { setShowReactions(false); setShowOptions(false); }}
    >
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold text-white">
          {(message.senderName || 'U')[0].toUpperCase()}
        </div>
      )}
      {showAvatar && isOwn && <div className="w-7 shrink-0" />}

      <div className={`flex flex-col gap-1 max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>

        {!isOwn && message.senderName && (
          <span className="text-xs text-cyan-400 font-medium px-1">{message.senderName}</span>
        )}

        <div className="relative">
          {/* Hover actions */}
          <div className={`
            absolute top-1/2 -translate-y-1/2 flex items-center gap-1
            opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10
            ${isOwn ? '-left-16' : '-right-16'}
          `}>
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="p-1.5 rounded-lg bg-bg-surface/90 border border-border-default hover:bg-accent/20 text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {!isOwn && (
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-1.5 rounded-lg bg-bg-surface/90 border border-border-default hover:bg-accent/20 text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>
            )}
          </div>

          {/* Reaction picker */}
          {showReactions && (
            <div className={`
              absolute bottom-full mb-2 z-20
              bg-bg-surface/90 backdrop-blur-sm border border-border-default
              rounded-2xl px-2 py-1.5 flex gap-1 shadow-xl
              ${isOwn ? 'right-0' : 'left-0'}
            `}>
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { onReact?.(message.id, emoji); setShowReactions(false); }}
                  className="text-lg hover:scale-125 transition-transform duration-150 p-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Report menu */}
          {showOptions && (
            <div className="absolute bottom-full mb-2 left-0 z-20 bg-bg-surface/90 backdrop-blur-sm border border-border-default rounded-xl overflow-hidden shadow-xl">
              <button
                onClick={() => { onReport?.(message.id); setShowOptions(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors w-full text-left whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                Report message
              </button>
            </div>
          )}

          {/* Bubble */}
          {isEmoji ? (
            <div className="text-4xl leading-none select-none p-1">{message.content}</div>
          ) : (
            <div className={`
              px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words
              ${isOwn
                ? 'bg-primary text-white rounded-br-sm shadow-lg shadow-primary/20'
                : 'bg-bg-surface/90 backdrop-blur-sm text-text-primary border border-border-default rounded-bl-sm'
              }
            `}>
              {message.content}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex gap-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-bg-surface/90 border border-border-default text-xs hover:bg-accent/20 transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-text-secondary">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + status */}
        {showTimestamp && (
          <div className={`flex items-center gap-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] text-text-disabled">{formatTime(message.timestamp)}</span>
            {isOwn && message.status && <StatusIcon status={message.status} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;