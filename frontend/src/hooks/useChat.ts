// src/hooks/useChat.ts
//
// FIX ERROR 2 (HIGH) — RTCPeerConnection was never closed on the receiver side
//   after partner skipped or disconnected.
//
//   Root cause: onMatchDisconnected only set isConnected=false.  It did not call
//   setSessionId(null) or setMatchedUser(null).  The useWebRTC signaling effect
//   closes the RTCPeerConnection only when sessionId changes (its dep array
//   includes sessionId).  With sessionId still non-null, the old PC stayed open
//   indefinitely — holding the DTLS connection, consuming CPU for keepalives, and
//   keeping the camera/mic tracks bound to a dead session.
//
//   The SESSION_EXPIRED event (which did clear both) acted as an eventual safety
//   net, but if that packet was lost or delayed the PC was never cleaned up at all.
//
//   Fix: onMatchDisconnected now calls setSessionId(null) and setMatchedUser(null)
//   immediately, guaranteed, before the system message is appended.
//   SESSION_EXPIRED remains in place as a secondary guard — calling setSessionId(null)
//   twice is idempotent and harmless.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '../components/chat/MessageBubble';
import { QueueType } from '../components/matching/QueueStatus';
import { SOCKET_EVENTS } from '../utils/constants';

interface MatchedUser {
  id:       string;
  username: string;
  avatar?:  string | null;
  role?:    'caller' | 'callee';
}

interface UseChatOptions {
  socket:  Socket | null;
  userId?: string;
}

interface UseChatReturn {
  // Matching state
  isSearching:     boolean;
  matchedUser:     MatchedUser | null;
  sessionId:       string | null;
  queuePosition:   number;

  // Chat state
  messages:        Message[];
  isPartnerTyping: boolean;
  isConnected:     boolean;

  // Actions
  startMatching:  (mode: QueueType) => void;
  cancelMatching: () => void;
  sendMessage:    (content: string) => void;
  sendTyping:     (isTyping: boolean) => void;
  skipPartner:    () => void;
  endSession:     () => void;
  reportUser:     (reason: string, description?: string) => void;
}

export const useChat = ({ socket, userId }: UseChatOptions): UseChatReturn => {
  const [isSearching,     setIsSearching]    = useState(false);
  const [matchedUser,     setMatchedUser]    = useState<MatchedUser | null>(null);
  const [sessionId,       setSessionId]      = useState<string | null>(null);
  const [queuePosition,   setQueuePosition]  = useState(0);
  const [messages,        setMessages]       = useState<Message[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isConnected,     setIsConnected]    = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const stopTypingTimer  = useRef<ReturnType<typeof setTimeout>>();
  const currentModeRef   = useRef<QueueType | null>(null);

  // ── Actions ────────────────────────────────────────────────────────────────

  const startMatching = useCallback((mode: QueueType) => {
    if (!socket || isSearching) return;
    currentModeRef.current = mode;
    setIsSearching(true);
    setMessages([]);
    socket.emit(SOCKET_EVENTS.QUEUE_JOIN, { type: mode });
  }, [socket, isSearching]);

  const cancelMatching = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.QUEUE_LEAVE, { type: currentModeRef.current });
    setIsSearching(false);
    setQueuePosition(0);
  }, [socket]);

  const sendMessage = useCallback((content: string) => {
    if (!socket || !sessionId || !userId) return;

    const tempMessage: Message = {
      id:        `temp-${Date.now()}`,
      content,
      senderId:  userId,
      timestamp: new Date(),
      status:    'sending',
    };
    setMessages(prev => [...prev, tempMessage]);

    socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { message: content });
  }, [socket, sessionId, userId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socket || !sessionId) return;
    clearTimeout(stopTypingTimer.current);

    if (isTyping) {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING);
      stopTypingTimer.current = setTimeout(() => {
        socket.emit(SOCKET_EVENTS.CHAT_STOP_TYPING);
      }, 3000);
    } else {
      socket.emit(SOCKET_EVENTS.CHAT_STOP_TYPING);
    }
  }, [socket, sessionId]);

  const skipPartner = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.MATCH_NEXT, { type: currentModeRef.current });
    setMessages([]);
    setMatchedUser(null);
    setSessionId(null);
    setIsConnected(false);
    setIsSearching(true);
  }, [socket]);

  const endSession = useCallback(() => {
    if (!socket || !sessionId) return;
    socket.emit(SOCKET_EVENTS.CALL_END, { sessionId });
    setMessages([]);
    setMatchedUser(null);
    setSessionId(null);
    setIsConnected(false);
    setIsSearching(false);
  }, [socket, sessionId]);

  const reportUser = useCallback((reason: string, description?: string) => {
    if (!socket || !sessionId || !matchedUser) return;
    socket.emit(SOCKET_EVENTS.REPORT_USER, {
      reportedUserId: matchedUser.id,
      sessionId,
      reason,
      description,
    });
  }, [socket, sessionId, matchedUser]);

  // ── Socket event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onQueuePosition = (data: { position: number }) => {
      setQueuePosition(data.position);
    };

    const onMatchFound = (data: {
      sessionId:       string;
      partnerId:       string;
      partnerUsername: string;
      sessionType:     string;
      role:            'caller' | 'callee';
    }) => {
      setIsSearching(false);
      setQueuePosition(0);
      setSessionId(data.sessionId);
      setMatchedUser({
        id:       data.partnerId,
        username: data.partnerUsername,
        avatar:   null,
        role:     data.role,
      });
      setIsConnected(true);
      setMessages([{
        id:        'system-connected',
        content:   `You are now connected with ${data.partnerUsername}`,
        senderId:  'system',
        timestamp: new Date(),
        type:      'system',
      } as Message]);
    };

    // FIX ERROR 2: clear sessionId and matchedUser immediately so useWebRTC's
    // signaling effect fires its cleanup (pc.close()) the moment the partner
    // disconnects or skips — not only when/if SESSION_EXPIRED arrives later.
    const onMatchDisconnected = (data: { reason: string }) => {
      setIsConnected(false);
      setSessionId(null);       // ← triggers RTCPeerConnection.close() via useWebRTC
      setMatchedUser(null);     // ← clears partner info
      setMessages(prev => [
        ...prev,
        {
          id:        `system-${Date.now()}`,
          content:   data.reason === 'partner_skipped'
            ? 'Your partner clicked Next'
            : 'Your partner has disconnected',
          senderId:  'system',
          timestamp: new Date(),
          type:      'system',
        } as Message,
      ]);
    };

    const onChatMessage = (data: { message: string; timestamp: number; senderId: string }) => {
      setMessages(prev => {
        if (data.senderId === userId) {
          const idx = prev.findIndex(m => m.status === 'sending');
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              id:        `msg-${data.timestamp}`,
              timestamp: new Date(data.timestamp),
              status:    'delivered',
            };
            return updated;
          }
        }
        return [
          ...prev,
          {
            id:        `msg-${data.timestamp}-${data.senderId}`,
            content:   data.message,
            senderId:  data.senderId,
            timestamp: new Date(data.timestamp),
            status:    'delivered',
          } as Message,
        ];
      });
    };

    const onTyping = () => {
      setIsPartnerTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
    };

    const onStopTyping = () => {
      clearTimeout(typingTimeoutRef.current);
      setIsPartnerTyping(false);
    };

    const onCallEnd = () => {
      setIsConnected(false);
      setSessionId(null);
      setMatchedUser(null);
      setMessages(prev => [
        ...prev,
        {
          id:        `system-${Date.now()}`,
          content:   'Chat session ended',
          senderId:  'system',
          timestamp: new Date(),
          type:      'system',
        } as Message,
      ]);
    };

    // Secondary guard — keeps state consistent even if onMatchDisconnected was
    // already applied (all setters are idempotent on the same values).
    const onSessionExpired = (data: { reason: string }) => {
      setIsConnected(false);
      setSessionId(null);
      setMatchedUser(null);
      setIsSearching(false);
      setMessages(prev => [
        ...prev,
        {
          id:        `system-${Date.now()}`,
          content:   data.reason || 'Session has expired',
          senderId:  'system',
          timestamp: new Date(),
          type:      'system',
        } as Message,
      ]);
    };

    socket.on(SOCKET_EVENTS.QUEUE_POSITION,     onQueuePosition);
    socket.on(SOCKET_EVENTS.MATCH_FOUND,        onMatchFound);
    socket.on(SOCKET_EVENTS.MATCH_DISCONNECTED, onMatchDisconnected);
    socket.on(SOCKET_EVENTS.SESSION_EXPIRED,    onSessionExpired);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE,       onChatMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING,        onTyping);
    socket.on(SOCKET_EVENTS.CHAT_STOP_TYPING,   onStopTyping);
    socket.on(SOCKET_EVENTS.CALL_END,           onCallEnd);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_POSITION,     onQueuePosition);
      socket.off(SOCKET_EVENTS.MATCH_FOUND,        onMatchFound);
      socket.off(SOCKET_EVENTS.MATCH_DISCONNECTED, onMatchDisconnected);
      socket.off(SOCKET_EVENTS.SESSION_EXPIRED,    onSessionExpired);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE,       onChatMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING,        onTyping);
      socket.off(SOCKET_EVENTS.CHAT_STOP_TYPING,   onStopTyping);
      socket.off(SOCKET_EVENTS.CALL_END,           onCallEnd);
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(stopTypingTimer.current);
    };
  }, [socket, userId]);

  return {
    isSearching,
    matchedUser,
    sessionId,
    queuePosition,
    messages,
    isPartnerTyping,
    isConnected,
    startMatching,
    cancelMatching,
    sendMessage,
    sendTyping,
    skipPartner,
    endSession,
    reportUser,
  };
};