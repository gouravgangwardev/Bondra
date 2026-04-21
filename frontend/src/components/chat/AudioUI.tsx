// src/components/chat/AudioUI.tsx
// Presentational only — no business logic.
// Renders the audio-only mode with controls to switch to video or back to chat.

import React from 'react';
import { AudioChat } from './AudioChat';
import { Message } from './MessageBubble';

export interface AudioUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  messages: Message[];
  currentUserId: string;
  partnerName?: string;
  isConnected?: boolean;
  isMuted?: boolean;
  sessionDuration?: number;
  onSendMessage: (content: string) => void;
  onToggleMute?: () => void;
  onSkip?: () => void;
  onEndChat?: () => void;
  onAddFriend?: () => void;
  onReport?: () => void;
  onTyping?: (isTyping: boolean) => void;
  isPartnerTyping?: boolean;
  // Mode-switch callbacks — must NOT reset session/socket/peer
  onSwitchToChat?: () => void;
  onSwitchToVideo?: () => void;
}

const AudioUI: React.FC<AudioUIProps> = ({
  localStream,
  remoteStream,
  messages,
  currentUserId,
  partnerName = 'Stranger',
  isConnected = true,
  isMuted = false,
  sessionDuration = 0,
  onSendMessage,
  onToggleMute,
  onSkip,
  onEndChat,
  onAddFriend,
  onReport,
  onTyping,
  isPartnerTyping = false,
  onSwitchToChat,
  onSwitchToVideo,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Mode-switch toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 bg-bg-secondary/80 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary mr-auto">Audio Mode</span>

        {onSwitchToChat && (
          <button
            onClick={onSwitchToChat}
            title="Back to Chat"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10
                       transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Back to Chat
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
            Switch to Video
          </button>
        )}
      </div>

      {/* Audio chat — takes remaining height */}
      <div className="flex-1 min-h-0 overflow-auto">
        <AudioChat
          localStream={localStream}
          remoteStream={remoteStream}
          messages={messages}
          currentUserId={currentUserId}
          partnerName={partnerName}
          isConnected={isConnected}
          isMuted={isMuted}
          sessionDuration={sessionDuration}
          onSendMessage={onSendMessage}
          onToggleMute={onToggleMute}
          onSkip={onSkip}
          onEndChat={onEndChat}
          onAddFriend={onAddFriend}
          onReport={onReport}
          onTyping={onTyping}
          isPartnerTyping={isPartnerTyping}
        />
      </div>
    </div>
  );
};

export default AudioUI;
