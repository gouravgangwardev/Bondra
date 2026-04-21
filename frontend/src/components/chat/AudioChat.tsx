// src/components/chat/AudioChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import MessageBubble, { Message } from './MessageBubble';
import ChatControls from './ChatControls';

interface AudioChatProps {
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
}

export const AudioChat: React.FC<AudioChatProps> = ({
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
}) => {
  const [showChat, setShowChat] = useState(true);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Play remote audio stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format session duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get avatar gradient
  const getGradient = (name: string): string => {
    const gradients = [
      'from-primary to-accent',
      'from-cyan-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-500',
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      
      {/* Audio Visualization Panel */}
      <div className="flex-1 flex flex-col bg-bg-secondary/80 border border-border-subtle rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-secondary/80">
          <div className="flex items-center gap-3">
            {/* Online indicator */}
            {isConnected && (
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            )}
            
            <div>
              <h3 className="font-semibold text-text-primary">{partnerName}</h3>
              <p className="text-xs text-text-secondary">
                {isConnected ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session timer */}
            {sessionDuration > 0 && (
              <div className="text-sm text-text-secondary font-mono">
                {formatDuration(sessionDuration)}
              </div>
            )}

            {/* Add friend button */}
            <button
              onClick={onAddFriend}
              className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-surface/90 transition-all"
              title="Add Friend"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>

            {/* Report button */}
            <button
              onClick={onReport}
              className="p-2 rounded-xl text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Report User"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Audio Visualization Area */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          
          {/* Audio visualization */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            
            {/* Partner avatar with pulse */}
            <div className="relative">
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getGradient(partnerName)} flex items-center justify-center text-4xl font-bold text-white shadow-2xl`}>
                {partnerName[0].toUpperCase()}
              </div>
              
              {/* Animated sound waves */}
              {isConnected && remoteStream && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
                </>
              )}
            </div>

            {/* Connection status */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary mb-2">{partnerName}</h2>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-text-disabled'}`} />
                <p className="text-sm text-text-secondary">
                  {isConnected ? 'Voice connected' : 'Connecting audio...'}
                </p>
              </div>
            </div>

            {/* Audio indicator bars */}
            {isConnected && remoteStream && (
              <div className="flex items-end gap-1.5 h-12">
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className="w-2 bg-gradient-to-t from-primary to-accent rounded-full animate-pulse"
                    style={{
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Remote audio element (hidden) */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        </div>

        {/* Audio Controls */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-secondary/80">
          <div className="flex items-center justify-center gap-4">
            
            {/* Mute button */}
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-bg-surface/90 text-text-secondary hover:bg-accent/20'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Skip button */}
            <button
              onClick={onSkip}
              className="w-14 h-14 rounded-full bg-bg-surface/90 text-text-secondary hover:bg-accent/20 flex items-center justify-center transition-all"
              title="Skip to Next"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>

            {/* End call button */}
            <button
              onClick={onEndChat}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-text-primary flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
              title="End Chat"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>

            {/* Chat toggle button */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                showChat
                  ? 'bg-primary/20 text-primary'
                  : 'bg-bg-surface/90 text-text-secondary hover:bg-accent/20'
              }`}
              title="Toggle Chat"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Text Chat Panel */}
      {showChat && (
        <div className="lg:w-96 flex flex-col bg-bg-secondary/80 border border-border-subtle rounded-2xl overflow-hidden">
          
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border-subtle bg-bg-secondary/80">
            <h3 className="font-semibold text-text-primary text-sm">Text Chat</h3>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary">Say hello to {partnerName}!</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === currentUserId}
                    showAvatar={
                      index === 0 ||
                      messages[index - 1].senderId !== message.senderId
                    }
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Chat input */}
          <div className="border-t border-border-subtle">
            <ChatControls
              onSendMessage={onSendMessage}
              onTyping={onTyping}
              isPartnerTyping={isPartnerTyping}
              disabled={!isConnected}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioChat;