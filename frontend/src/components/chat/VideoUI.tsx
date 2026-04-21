// src/components/chat/VideoUI.tsx
// Presentational only — no business logic.
// Renders the video mode with controls to go back to chat.

import React from 'react';
import VideoChat from './VideoChat';
import { Message } from './MessageBubble';

export interface VideoUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  currentUserId: string;
  partner?: { id: string; name: string; avatar?: string };
  messages?: Message[];
  isConnected: boolean;
  isConnecting?: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  partnerMuted?: boolean;
  partnerVideoOff?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onSkip?: () => void;
  onSendMessage?: (msg: string) => void;
  onTyping?: (typing: boolean) => void;
  partnerTyping?: boolean;
  connectionTime?: number;
  // Mode-switch callback — must NOT reset session/socket/peer
  onSwitchToChat?: () => void;
}

const VideoUI: React.FC<VideoUIProps> = ({
  localStream,
  remoteStream,
  currentUserId,
  partner,
  messages = [],
  isConnected,
  isConnecting = false,
  isMuted,
  isVideoOff,
  partnerMuted = false,
  partnerVideoOff = false,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onSkip,
  onSendMessage,
  onTyping,
  partnerTyping = false,
  connectionTime = 0,
  onSwitchToChat,
}) => {
  return (
    <div className="relative w-full h-full">
      {/* Back to Chat pill — overlaid top-left, below the VideoChat top bar */}
      {onSwitchToChat && (
        <div className="absolute top-14 left-3 z-30">
          <button
            onClick={onSwitchToChat}
            title="Back to Chat"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-cyan-300 bg-bg-secondary/80 border border-cyan-500/30
                       hover:bg-cyan-500/20 backdrop-blur-sm transition-all shadow-lg"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Back to Chat
          </button>
        </div>
      )}

      <VideoChat
        localStream={localStream}
        remoteStream={remoteStream}
        currentUserId={currentUserId}
        partner={partner}
        messages={messages}
        isConnected={isConnected}
        isConnecting={isConnecting}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        partnerMuted={partnerMuted}
        partnerVideoOff={partnerVideoOff}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onEndCall={onEndCall}
        onSkip={onSkip}
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        partnerTyping={partnerTyping}
        connectionTime={connectionTime}
      />
    </div>
  );
};

export default VideoUI;
