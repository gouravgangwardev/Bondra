import React, { useEffect, useState, useRef } from 'react';
import VideoChat from '../components/chat/VideoChat';
import { Message } from '../components/chat/MessageBubble';

interface Partner {
  id: string;
  name: string;
  avatar?: string;
}

const Chat: React.FC = () => {
  /* ================= STATE ================= */

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const [partner, setPartner] = useState<Partner | undefined>();
  const [connectionTime, setConnectionTime] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUserId = 'me'; // Replace with auth user ID

  /* ================= MEDIA INIT ================= */

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);
      } catch (error) {
        console.error('Media access denied:', error);
      }
    };

    initMedia();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  /* ================= CONNECTION TIMER ================= */

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setConnectionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setConnectionTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  /* ================= ACTIONS ================= */

  const handleToggleMute = () => {
    if (!localStream) return;

    localStream.getAudioTracks().forEach(track => {
      track.enabled = isMuted;
    });

    setIsMuted(prev => !prev);
  };

  const handleToggleVideo = () => {
    if (!localStream) return;

    localStream.getVideoTracks().forEach(track => {
      track.enabled = isVideoOff;
    });

    setIsVideoOff(prev => !prev);
  };

  const handleEndChat = () => {
    setIsConnected(false);
    setRemoteStream(null);
    setMessages([]);
    setPartner(undefined);
  };

  const handleSkip = () => {
    handleEndChat();
    simulateConnection();
  };

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      content: text,
      timestamp: new Date(), // IMPORTANT: must be Date
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const handleTyping = (typing: boolean) => {
    setPartnerTyping(typing);
  };

  /* ================= MOCK CONNECTION (REMOVE IN PROD) ================= */

  const simulateConnection = () => {
    setIsConnecting(true);

    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);

      setPartner({
        id: 'user-2',
        name: 'Stranger',
      });

      // Simulated remote stream (replace with real WebRTC)
      setRemoteStream(localStream);
    }, 2000);
  };

  useEffect(() => {
    simulateConnection();
  }, []);

  /* ================= RENDER ================= */

  return (
    <div className="w-screen h-screen bg-black">
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
        partnerMuted={false}
        partnerVideoOff={false}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onEndCall={handleEndChat}
        onSkip={handleSkip}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        partnerTyping={partnerTyping}
        connectionTime={connectionTime}
      />
    </div>
  );
};

export default Chat;
