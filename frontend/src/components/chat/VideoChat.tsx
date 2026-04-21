// src/components/chat/VideoChat.tsx
//
// FIX ERROR 2 (HIGH) — Video goes blank after PIP swap.
//   Root cause: the two useEffects that assign srcObject only listed the stream
//   itself as a dependency.  When the user clicked "Swap", React unmounted the old
//   <video> and mounted a new one (because the two branches render different
//   elements), updating the ref to point at the fresh DOM node.  But neither
//   effect re-ran (streams hadn't changed), so srcObject was never set on the new
//   element and both local and remote video went permanently blank.
//
//   Fix: add `isLocalPip` to both useEffect dependency arrays.  When isLocalPip
//   changes the effects re-run, find the newly mounted element through the ref,
//   and reassign srcObject.

import React, { useRef, useEffect, useState } from 'react';
import ChatControls from './ChatControls';
import Avatar from '../common/Avatar';
import LoadingSpinner from '../common/LoadingSpinner';
import MessageBubble, { Message } from './MessageBubble';

interface VideoChatProps {
  localStream:  MediaStream | null;
  remoteStream: MediaStream | null;

  currentUserId: string;

  partner?: {
    id:     string;
    name:   string;
    avatar?: string;
  };

  messages?: Message[];

  isConnected:   boolean;
  isConnecting?: boolean;

  isMuted:      boolean;
  isVideoOff:   boolean;

  partnerMuted?:    boolean;
  partnerVideoOff?: boolean;

  onToggleMute:  () => void;
  onToggleVideo: () => void;
  onEndCall:     () => void;
  onSkip?:       () => void;

  onSendMessage?: (msg: string) => void;
  onTyping?:      (typing: boolean) => void;
  partnerTyping?: boolean;

  connectionTime?: number;
}

const VideoChat: React.FC<VideoChatProps> = ({
  localStream,
  remoteStream,
  currentUserId,
  partner,
  messages = [],
  isConnected,
  isConnecting = false,
  isMuted,
  isVideoOff,
  partnerMuted    = false,
  partnerVideoOff = false,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onSkip,
  onSendMessage,
  onTyping,
  partnerTyping   = false,
  connectionTime  = 0,
}) => {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showChat,      setShowChat]      = useState(false);
  const [isLocalPip,    setIsLocalPip]    = useState(true);
  const [showControls,  setShowControls]  = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stream binding ─────────────────────────────────────────────────────────
  // FIX ERROR 2: isLocalPip added to both deps arrays.
  // When the user swaps PIP, React unmounts one <video> and mounts a fresh one.
  // The ref is updated to the new element, but without isLocalPip in the deps the
  // effects would not re-run and srcObject would never be set on the new element.

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isLocalPip]);   // ← isLocalPip added

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isLocalPip]);  // ← isLocalPip added

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-hide controls ─────────────────────────────────────────────────────

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    if (isConnected) resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isConnected]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleSwap = () => setIsLocalPip(prev => !prev);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full h-full bg-bg-primary overflow-hidden"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* MAIN VIDEO */}
      <div className="absolute inset-0">
        {isLocalPip ? (
          remoteStream && isConnected ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-bg-secondary">
              {isConnecting ? (
                <LoadingSpinner variant="ring" size="xl" label="Connecting..." />
              ) : (
                <>
                  {partner && (
                    <Avatar name={partner.name} src={partner.avatar} size="2xl" />
                  )}
                  <p className="text-text-secondary text-sm mt-3">
                    {partnerVideoOff
                      ? `${partner?.name ?? 'Partner'} turned off camera`
                      : 'Waiting for connection...'}
                  </p>
                </>
              )}
            </div>
          )
        ) : localStream && !isVideoOff ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
            <p className="text-text-secondary text-sm">Camera is off</p>
          </div>
        )}
      </div>

      {/* SWAP PREVIEW (PIP thumbnail) */}
      <button
        onClick={handleSwap}
        className="absolute top-14 right-3 z-20 w-28 h-40 rounded-xl overflow-hidden border border-border-default bg-bg-secondary"
      >
        {!isLocalPip ? (
          remoteStream && isConnected ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Avatar name={partner?.name ?? 'P'} size="md" />
            </div>
          )
        ) : localStream && !isVideoOff ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-text-secondary">No Camera</p>
          </div>
        )}
      </button>

      {/* TOP BAR */}
      <div
        className={`absolute top-0 inset-x-0 z-10 px-4 py-3 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          {partner && (
            <Avatar name={partner.name} src={partner.avatar} size="sm" />
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {partner?.name ?? 'Stranger'}
              {partnerMuted && (
                <span className="ml-2 text-xs text-red-400">(muted)</span>
              )}
            </p>
            {isConnected && (
              <p className="text-xs text-emerald-400 font-mono">
                {formatDuration(connectionTime)}
              </p>
            )}
          </div>
        </div>

        {onSendMessage && (
          <button
            onClick={() => setShowChat(prev => !prev)}
            className="text-xs px-3 py-1 rounded-lg bg-bg-surface text-text-secondary"
          >
            {showChat ? 'Hide Chat' : 'Chat'}
          </button>
        )}
      </div>

      {/* SIDE CHAT */}
      {showChat && onSendMessage && (
        <div className="absolute top-0 right-0 bottom-0 w-72 z-20 flex flex-col bg-bg-primary border-l border-border-subtle">
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === currentUserId}
                showAvatar={i === 0 || messages[i - 1]?.senderId !== msg.senderId}
                showTimestamp
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ChatControls
            onSendMessage={onSendMessage}
            onTyping={onTyping}
            isPartnerTyping={partnerTyping}
          />
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      <div
        className={`absolute bottom-0 inset-x-0 z-10 pb-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        } ${showChat ? 'pr-72' : ''}`}
      >
        <ChatControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onEndCall={onEndCall}
          onSkip={onSkip}
          disabled={!isConnected}
        />
      </div>
    </div>
  );
};

export default VideoChat;