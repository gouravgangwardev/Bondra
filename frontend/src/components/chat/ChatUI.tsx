// src/components/chat/ChatUI.tsx
// Presentational only — no business logic.
// Renders the text-chat mode with action buttons to switch to audio/video or go next.

import React from 'react';
import TextChat from './TextChat';
import { Message } from './MessageBubble';

export interface ChatUIProps {
  messages: Message[];
  currentUserId: string;
  partnerName?: string;
  partnerAvatar?: string;
  isPartnerTyping?: boolean;
  isConnected?: boolean;
  sessionDuration?: number;
  onSendMessage: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onSkip?: () => void;
  onEndChat?: () => void;
  onReact?: (messageId: string, emoji: string) => void;
  onReport?: (messageId: string) => void;
  onAddFriend?: () => void;
  // Mode-switch callbacks — must NOT reset session/socket/peer
  onSwitchToAudio?: () => void;
  onSwitchToVideo?: () => void;
}

const ChatUI: React.FC<ChatUIProps> = ({
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
  onSwitchToAudio,
  onSwitchToVideo,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Mode-switch toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 bg-bg-secondary/80 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary mr-auto">Text Mode</span>

        {onSwitchToAudio && (
          <button
            onClick={onSwitchToAudio}
            title="Switch to Audio"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10
                       transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Start Audio
          </button>
        )}

        {onSwitchToVideo && (
          <button
            onClick={onSwitchToVideo}
            title="Switch to Video"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-primary border border-primary/30 hover:bg-primary-hover/10
                       transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            Start Video
          </button>
        )}
      </div>

      {/* Text chat — takes remaining height */}
      <div className="flex-1 min-h-0">
        <TextChat
          messages={messages}
          currentUserId={currentUserId}
          partnerName={partnerName}
          partnerAvatar={partnerAvatar}
          isPartnerTyping={isPartnerTyping}
          isConnected={isConnected}
          sessionDuration={sessionDuration}
          onSendMessage={onSendMessage}
          onTyping={onTyping}
          onSkip={onSkip}
          onEndChat={onEndChat}
          onReact={onReact}
          onReport={onReport}
          onAddFriend={onAddFriend}
        />
      </div>
    </div>
  );
};

export default ChatUI;
