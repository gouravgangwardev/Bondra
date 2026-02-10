// src/components/chat/MessageBubble.tsx
import React, { useState } from 'react';
import Avatar from '../common/Avatar';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: Date;
  status?: MessageStatus;
  type: 'text' | 'image' | 'system';
  isOwn: boolean;
  reactions?: Array<{ emoji: string; count: number; reacted: boolean }>;
}

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
  onReport?: (messageId: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const StatusIcon: React.FC<{ status: MessageStatus }> = ({ status }) => {
  if (status === 'sending') return (
    <svg className="w-3 h-3 text-gray-600 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 10" />
    </svg>
  );
  if (status === 'sent') return (
    <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  if (status === 'delivered') return (
    <svg className="w-3.5 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="17 6 8 17 3 12" />
      <polyline points="22 6 13 17 11 15" />
    </svg>
  );
  if (status === 'read') return (
    <svg className="w-3.5 h-3 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="17 6 8 17 3 12" />
      <polyline points="22 6 13 17 11 15" />
    </svg>
  );
  if (status === 'failed') return (
    <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
  return null;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAvatar = true,
  showTimestamp = true,
  onReact,
  onReport,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // System message (joined/left/matched)
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full text-xs text-gray-500 bg-gray-800/50 border border-gray-700/30">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-end gap-2 mb-1 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseLeave={() => { setShowReactions(false); setShowMenu(false); }}
    >
      {/* Avatar */}
      {showAvatar && !message.isOwn ? (
        <div className="shrink-0 mb-1">
          <Avatar
            src={message.senderAvatar}
            name={message.senderName}
            size="sm"
            status="online"
            showStatus
          />
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      {/* Bubble + meta */}
      <div className={`flex flex-col gap-1 max-w-[72%] ${message.isOwn ? 'items-end' : 'items-start'}`}>

        {/* Sender name (only for others) */}
        {!message.isOwn && showAvatar && (
          <span className="text-xs font-semibold text-gray-400 ml-1">{message.senderName}</span>
        )}

        {/* Bubble row with action buttons */}
        <div className={`flex items-center gap-1.5 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

          {/* Action buttons - appear on hover */}
          <div className={`
            flex items-center gap-0.5 opacity-0 group-hover:opacity-100
            transition-opacity duration-150
          `}>
            {/* React button */}
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-lg hover:bg-gray-800/80 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Reaction picker */}
              {showReactions && (
                <div className={`
                  absolute bottom-full mb-1 z-10
                  ${message.isOwn ? 'right-0' : 'left-0'}
                  flex items-center gap-1 p-1.5
                  bg-gray-900 border border-gray-700/60
                  rounded-xl shadow-xl
                `}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { onReact?.(message.id, emoji); setShowReactions(false); }}
                      className="text-base hover:scale-125 transition-transform duration-100 p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* More options */}
            {!message.isOwn && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg hover:bg-gray-800/80 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                  </svg>
                </button>
                {showMenu && (
                  <div className={`
                    absolute bottom-full mb-1 z-10
                    ${message.isOwn ? 'right-0' : 'left-0'}
                    bg-gray-900 border border-gray-700/60
                    rounded-xl shadow-xl overflow-hidden min-w-[120px]
                  `}>
                    <button
                      onClick={() => { onReport?.(message.id); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      Report
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* The bubble itself */}
          <div
            className={`
              relative px-3.5 py-2.5 rounded-2xl
              text-sm leading-relaxed break-words
              transition-all duration-150
              ${message.isOwn
                ? `bg-gradient-to-br from-violet-600 to-indigo-700
                   text-white rounded-br-sm
                   shadow-lg shadow-violet-900/30`
                : `bg-gray-800/80 backdrop-blur-sm
                   text-gray-100 rounded-bl-sm
                   border border-gray-700/40`
              }
              ${message.status === 'failed' ? 'opacity-60' : ''}
            `}
          >
            {message.content}

            {/* Timestamp inside bubble */}
            {showTimestamp && (
              <div className={`
                flex items-center gap-1 mt-0.5
                text-[10px] select-none
                ${message.isOwn ? 'justify-end text-violet-200/60' : 'justify-end text-gray-500'}
              `}>
                <span>{formatTime(message.timestamp)}</span>
                {message.isOwn && message.status && (
                  <StatusIcon status={message.status} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex items-center gap-1 flex-wrap ${message.isOwn ? 'justify-end' : 'justify-start'} ml-1`}>
            {message.reactions.map(({ emoji, count, reacted }) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                  border transition-all duration-150
                  ${reacted
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:border-gray-600'
                  }
                `}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-medium">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
