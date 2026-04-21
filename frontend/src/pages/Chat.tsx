// src/pages/Chat.tsx
//
// CHANGE SUMMARY
// ==============
// Added `mode` state (chat | audio | video) that drives conditional rendering
// between ChatUI, AudioUI, and VideoUI.
//
// CRITICAL CONSTRAINTS HONOURED
// ==============================
// • Switching mode does NOT reset the session, disconnect the socket,
//   recreate the RTCPeerConnection, or clear chat history.
// • All business logic (useChat, useWebRTC) stays in this file and is
//   initialised once per route mount — mode switches only swap the view.
// • ChatUI, AudioUI, VideoUI are purely presentational; they receive props
//   and call callbacks but contain no state of their own that would be lost
//   on re-render.
//
// BEHAVIOUR PER MODE
// ==================
// chat  → ChatUI   (messages + input, Start Audio / Start Video / Next buttons)
// audio → AudioUI  (mic controls, switch to video, back to chat)
// video → VideoUI  (video streams, camera + mic controls, back to chat)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import { useWebRTC } from '../hooks/useWebRTC';
import ChatUI from '../components/chat/ChatUI';
import AudioUI from '../components/chat/AudioUI';
import VideoUI from '../components/chat/VideoUI';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MatchingScreen from '../components/matching/MatchingScreen';

// The UI mode — independent of the queue / WebRTC mode.
type UIMode = 'chat' | 'audio' | 'video';

// The initial queue type derived from the URL ?mode= param.
type QueueType = 'video' | 'audio' | 'text';

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuthContext();
  const { socket, isConnected: socketConnected } = useSocketContext();

  // ── Initial queue mode from URL ──────────────────────────────────────────
  const modeParam = searchParams.get('mode') as QueueType | null;
  const queueMode: QueueType =
    modeParam && ['video', 'audio', 'text'].includes(modeParam) ? modeParam : 'text';

  // ── UI mode state ────────────────────────────────────────────────────────
  // Initialise from URL: video→video, audio→audio, text→chat.
  const initialUIMode: UIMode =
    queueMode === 'video' ? 'video' : queueMode === 'audio' ? 'audio' : 'chat';

  const [mode, setMode] = useState<UIMode>(initialUIMode);

  // ── Business logic hooks (never recreated on mode switch) ─────────────────
  const {
    isSearching,
    matchedUser,
    sessionId,
    messages,
    isPartnerTyping,
    isConnected,
    startMatching,
    cancelMatching,
    sendMessage,
    sendTyping,
    skipPartner,
    endSession,
  } = useChat({ socket, userId: user?.id });

  // WebRTC runs for audio & video modes.
  // When mode is 'chat' we still pass a valid rtcMode so the hook type is stable,
  // but sessionId is withheld when in chat-only mode so no PC is created.
  const rtcMode: 'video' | 'audio' = mode === 'video' ? 'video' : 'audio';

  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isConnecting: rtcConnecting,
    error: rtcError,
    startMedia,
    stopMedia,
    toggleMute,
    toggleVideo,
  } = useWebRTC({
    socket,
    sessionId: mode !== 'chat' ? (sessionId ?? undefined) : undefined,
    mode: rtcMode,
    role: matchedUser?.role ?? 'caller',
  });

  // ── Connection timer ──────────────────────────────────────────────────────
  const [connectionTime, setConnectionTime] = useState(0);
  useEffect(() => {
    if (!isConnected) { setConnectionTime(0); return; }
    const t = setInterval(() => setConnectionTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  // ── Session duration (for ChatUI / AudioUI) ───────────────────────────────
  const [sessionDuration, setSessionDuration] = useState(0);
  useEffect(() => {
    if (!isConnected) { setSessionDuration(0); return; }
    const t = setInterval(() => setSessionDuration(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  // ── Start matching once on socket connect (guard against re-fire) ─────────
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!socketConnected) {
      hasStartedRef.current = false;
      return;
    }
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      // Only acquire media if we launched in audio/video mode.
      if (queueMode !== 'text') await startMedia();
      startMatching(queueMode);
    };
    run();

    return () => {
      stopMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected]);

  // ── Redirect if not authenticated ────────────────────────────────────────
  useEffect(() => {
    if (!user) navigate('/', { replace: true });
  }, [user, navigate]);

  // ── Mode-switch handlers ─────────────────────────────────────────────────
  // These ONLY update the UI mode.
  // They do NOT touch socket, sessionId, peerConnection, or messages.

  const switchToChat = useCallback(() => {
    setMode('chat');
  }, []);

  const switchToAudio = useCallback(async () => {
    if (mode !== 'audio') {
      if (!localStream) await startMedia();
    }
    setMode('audio');
  }, [mode, localStream, startMedia]);

  const switchToVideo = useCallback(async () => {
    if (mode !== 'video') {
      if (!localStream) await startMedia();
    }
    setMode('video');
  }, [mode, localStream, startMedia]);

  // ── End-call / skip ───────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    endSession();
    stopMedia();
    navigate('/dashboard');
  }, [endSession, stopMedia, navigate]);

  const handleSkip = useCallback(() => {
    skipPartner();
  }, [skipPartner]);

  // ── Partner shape for VideoUI ─────────────────────────────────────────────
  const partner = matchedUser
    ? { id: matchedUser.id, name: matchedUser.username, avatar: matchedUser.avatar ?? undefined }
    : undefined;

  // ── Matching / searching overlay ─────────────────────────────────────────
  const showMatching = !sessionId;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Global RTC error banner */}
      {rtcError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-text-primary px-4 py-2 rounded-lg text-sm shadow-lg">
          {rtcError}
        </div>
      )}

      {/* ── Matching / searching overlay ── */}
      {showMatching && (
        <div className="flex-1 flex items-center justify-center p-4">
          {isSearching ? (
            <MatchingScreen
              state="searching"
              selectedMode={queueMode}
              waitTime={sessionDuration}
              onCancelSearch={() => { cancelMatching(); navigate('/dashboard'); }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-text-secondary">
              <LoadingSpinner size="lg" />
              <p className="text-sm">Waiting for connection…</p>
            </div>
          )}
        </div>
      )}

      {/* ── Active session UI (conditional on mode) ── */}
      {!showMatching && (
        <div className="flex-1 min-h-0">

          {/* CHAT MODE */}
          {mode === 'chat' && (
            <ChatUI
              messages={messages}
              currentUserId={user?.id ?? 'me'}
              partnerName={matchedUser?.username}
              isPartnerTyping={isPartnerTyping}
              isConnected={isConnected}
              sessionDuration={sessionDuration}
              onSendMessage={sendMessage}
              onTyping={sendTyping}
              onSkip={handleSkip}
              onEndChat={handleEndCall}
              onSwitchToAudio={switchToAudio}
              onSwitchToVideo={switchToVideo}
            />
          )}

          {/* AUDIO MODE */}
          {mode === 'audio' && (
            <AudioUI
              localStream={localStream}
              remoteStream={remoteStream}
              messages={messages}
              currentUserId={user?.id ?? 'me'}
              partnerName={matchedUser?.username}
              isConnected={isConnected}
              isMuted={isMuted}
              sessionDuration={sessionDuration}
              onSendMessage={sendMessage}
              onToggleMute={toggleMute}
              onSkip={handleSkip}
              onEndChat={handleEndCall}
              onTyping={sendTyping}
              isPartnerTyping={isPartnerTyping}
              onSwitchToChat={switchToChat}
              onSwitchToVideo={switchToVideo}
            />
          )}

          {/* VIDEO MODE */}
          {mode === 'video' && (
            <VideoUI
              localStream={localStream}
              remoteStream={remoteStream}
              currentUserId={user?.id ?? 'me'}
              partner={partner}
              messages={messages}
              isConnected={isConnected}
              isConnecting={isSearching || rtcConnecting}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              onToggleMute={toggleMute}
              onToggleVideo={toggleVideo}
              onEndCall={handleEndCall}
              onSkip={handleSkip}
              onSendMessage={sendMessage}
              onTyping={sendTyping}
              partnerTyping={isPartnerTyping}
              connectionTime={connectionTime}
              onSwitchToChat={switchToChat}
            />
          )}

        </div>
      )}
    </div>
  );
};

export default Chat;
