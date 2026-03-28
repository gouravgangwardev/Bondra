import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VideoChat from '../components/chat/VideoChat';
import { useAuthContext } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import { useWebRTC } from '../hooks/useWebRTC';

type ChatMode = 'video' | 'audio' | 'text';

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auth & socket from context — no more hardcoded URLs or mock logic
  const { user } = useAuthContext();
  const { socket, isConnected: socketConnected } = useSocketContext();

  // Determine mode from URL param, default to video
  const modeParam = searchParams.get('mode') as ChatMode | null;
  const mode: ChatMode =
    modeParam && ['video', 'audio', 'text'].includes(modeParam) ? modeParam : 'video';

  // ── Chat matching + messaging ──────────────────────────────────────────────
  const {
    isSearching,
    matchedUser,
    sessionId,
    messages,
    isPartnerTyping,
    isConnected,
    startMatching,
    sendMessage,
    sendTyping,
    skipPartner,
    endSession,
  } = useChat({ socket, userId: user?.id });

  // ── WebRTC (video / audio modes only) ─────────────────────────────────────
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
    sessionId: sessionId ?? undefined,
    mode: mode === 'text' ? 'audio' : mode,
    role: matchedUser?.role ?? 'caller',
  });

  // ── Connection timer ───────────────────────────────────────────────────────
  const [connectionTime, setConnectionTime] = useState(0);
  useEffect(() => {
    if (!isConnected) { setConnectionTime(0); return; }
    const t = setInterval(() => setConnectionTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  // ── Start media + matching once socket is ready ────────────────────────────
  useEffect(() => {
    if (!socketConnected) return;
    const run = async () => {
      if (mode !== 'text') await startMedia();
      startMatching(mode);
    };
    run();
    return () => { stopMedia(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected]);

  // ── Redirect if not logged in ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) navigate('/', { replace: true });
  }, [user, navigate]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSkip = () => skipPartner();

  const handleEndCall = () => {
    endSession();
    stopMedia();
    navigate('/dashboard');
  };

  const partner = matchedUser
    ? { id: matchedUser.id, name: matchedUser.username, avatar: matchedUser.avatar ?? undefined }
    : undefined;

  return (
    <div className="w-screen h-screen bg-black">
      {rtcError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {rtcError}
        </div>
      )}
      <VideoChat
        localStream={localStream}
        remoteStream={remoteStream}
        currentUserId={user?.id ?? 'me'}
        partner={partner}
        messages={messages}
        isConnected={isConnected}
        isConnecting={isSearching || rtcConnecting}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        partnerMuted={false}
        partnerVideoOff={false}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onEndCall={handleEndCall}
        onSkip={handleSkip}
        onSendMessage={sendMessage}
        onTyping={sendTyping}
        partnerTyping={isPartnerTyping}
        connectionTime={connectionTime}
      />
    </div>
  );
};

export default Chat;
