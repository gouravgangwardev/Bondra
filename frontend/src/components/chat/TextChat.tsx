// src/components/chat/TextChat.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import MessageBubble, { Message } from './MessageBubble';
import ChatControls from './ChatControls';

interface TextChatProps {
  messages: Message[];
  currentUserId: string;
  partnerName?: string;
  partnerAvatar?: string;
  isPartnerTyping?: boolean;
  isConnected?: boolean;
  sessionDuration?: number; // seconds
  onSendMessage: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onSkip?: () => void;
  onEndChat?: () => void;
  onReact?: (messageId: string, emoji: string) => void;
  onReport?: (messageId: string) => void;
  onAddFriend?: () => void;
}

const TextChat: React.FC<TextChatProps> = ({
  messages,
  currentUserId,
  partnerName = 'Stranger',
  partnerAvatar,
  isPartnerTyping = false,
  isConnected = true,
  sessionDuration = 0,
  onSendMessage,
  onTyping,
  onSkip,
  onEndChat,
  onReact,
  onReport,
  onAddFriend,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    } else {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.senderId !== currentUserId) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isAtBottom, currentUserId, scrollToBottom]);

  // Track scroll position
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  };

  // Format session duration
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary rounded-2xl overflow-hidden border border-border-subtle">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-secondary/80 backdrop-blur-sm border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden">
              {partnerAvatar
                ? <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
                : partnerName[0].toUpperCase()
              }
            </div>
            {/* Online dot */}
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${isConnected ? 'bg-emerald-400' : 'bg-text-disabled'}`} />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">{partnerName}</span>
            <span className="text-xs text-text-secondary">
              {isConnected ? 'Connected' : 'Disconnected'} · {formatDuration(sessionDuration)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onAddFriend && (
            <button
              onClick={onAddFriend}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Friend
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="p-2 rounded-xl text-text-secondary hover:text-text-secondary hover:bg-bg-surface/90 transition-all"
              title="Skip to next"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {onEndChat && (
            <button
              onClick={onEndChat}
              className="p-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="End chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#A5A58D transparent' }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-primary/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">Say hello to {partnerName}!</p>
              <p className="text-xs text-text-disabled mt-1">Be respectful and have fun 👋</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
            const showTimestamp = index === messages.length - 1 ||
              messages[index + 1]?.senderId !== msg.senderId;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === currentUserId}
                showAvatar={showAvatar}
                showTimestamp={showTimestamp}
                onReact={onReact}
                onReport={onReport}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <div className="relative">
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-2 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-lg shadow-primary/20 transition-all"
          >
            {unreadCount > 0 && (
              <span className="bg-white text-primary text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Input controls */}
      <div className="shrink-0 border-t border-border-subtle bg-bg-secondary/80">
        <ChatControls
          onSendMessage={onSendMessage}
          onTyping={onTyping}
          onSkip={onSkip}
          onEndChat={onEndChat}
          disabled={!isConnected}
          partnerName={partnerName}
          isPartnerTyping={isPartnerTyping}
        />
      </div>
    </div>
  );
};

export default TextChat;