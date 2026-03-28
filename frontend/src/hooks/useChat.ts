// src/hooks/useChat.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '../components/chat/MessageBubble';
import { QueueType } from '../components/matching/QueueStatus';
import { SOCKET_EVENTS } from '../utils/constants';

interface MatchedUser {
  id: string;
  username: string;
  avatar?: string | null;
  role?: 'caller' | 'callee'; // tells useWebRTC who creates the offer
}

interface UseChatOptions {
  socket: Socket | null;
  userId?: string;
}

interface UseChatReturn {
  // Matching state
  isSearching:       boolean;
  matchedUser:       MatchedUser | null;
  sessionId:         string | null;
  queuePosition:     number;

  // Chat state
  messages:          Message[];
  isPartnerTyping:   boolean;
  isConnected:       boolean;

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
  const [isSearching,     setIsSearching]     = useState(false);
  const [matchedUser,     setMatchedUser]      = useState<MatchedUser | null>(null);
  const [sessionId,       setSessionId]        = useState<string | null>(null);
  const [queuePosition,   setQueuePosition]    = useState(0);
  const [messages,        setMessages]         = useState<Message[]>([]);
  const [isPartnerTyping, setIsPartnerTyping]  = useState(false);
  const [isConnected,     setIsConnected]      = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const stopTypingTimer  = useRef<ReturnType<typeof setTimeout>>();
  const currentModeRef   = useRef<QueueType | null>(null);

  // ── Actions ────────────────────────────────────────────────────────────────

  const startMatching = useCallback((mode: QueueType) => {
    if (!socket || isSearching) return;
    currentModeRef.current = mode;
    setIsSearching(true);
    setMessages([]);
    // backend event: queue:join  payload: { type }
    socket.emit(SOCKET_EVENTS.QUEUE_JOIN, { type: mode });
  }, [socket, isSearching]);

  const cancelMatching = useCallback(() => {
    if (!socket) return;
    // backend event: queue:leave  payload: { type }
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

    // backend event: chat:message  payload: { message }
    socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { message: content });
  }, [socket, sessionId, userId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socket || !sessionId) return;
    clearTimeout(stopTypingTimer.current);

    if (isTyping) {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING);
      // auto stop-typing after 3 s so partner indicator clears
      stopTypingTimer.current = setTimeout(() => {
        socket.emit(SOCKET_EVENTS.CHAT_STOP_TYPING);
      }, 3000);
    } else {
      socket.emit(SOCKET_EVENTS.CHAT_STOP_TYPING);
    }
  }, [socket, sessionId]);

  const skipPartner = useCallback(() => {
    if (!socket) return;
    // backend event: match:next  — re-queues for same mode
    socket.emit(SOCKET_EVENTS.MATCH_NEXT);
    setMessages([]);
    setMatchedUser(null);
    setSessionId(null);
    setIsConnected(false);
    setIsSearching(true); // still searching after skip
  }, [socket]);

  const endSession = useCallback(() => {
    if (!socket || !sessionId) return;
    // backend event: call:end  payload: { sessionId }
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

    // ── Queue feedback ────────────────────────────────────────────────────────
    const onQueuePosition = (data: { position: number }) => {
      setQueuePosition(data.position);
    };

    // ── Match found ──────────────────────────────────────────────────────────
    // backend emits: match:found  { sessionId, partnerId, partnerUsername, sessionType, role }
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

    // ── Partner disconnected / skipped ────────────────────────────────────────
    // backend emits: match:disconnected  { reason }
    const onMatchDisconnected = (data: { reason: string }) => {
      setIsConnected(false);
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

    // ── Incoming chat message ─────────────────────────────────────────────────
    // backend emits: chat:message  { message, timestamp, senderId }
    const onChatMessage = (data: { message: string; timestamp: number; senderId: string }) => {
      // replace the temp optimistic message if this came from us, otherwise add
      setMessages(prev => {
        if (data.senderId === userId) {
          // replace oldest 'sending' temp message with confirmed one
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

    // ── Typing indicators ─────────────────────────────────────────────────────
    const onTyping = () => {
      setIsPartnerTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
    };

    const onStopTyping = () => {
      clearTimeout(typingTimeoutRef.current);
      setIsPartnerTyping(false);
    };

    // ── Call ended by partner ─────────────────────────────────────────────────
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

    // Register
    socket.on(SOCKET_EVENTS.QUEUE_POSITION,      onQueuePosition);
    socket.on(SOCKET_EVENTS.MATCH_FOUND,         onMatchFound);
    socket.on(SOCKET_EVENTS.MATCH_DISCONNECTED,  onMatchDisconnected);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE,        onChatMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING,         onTyping);
    socket.on(SOCKET_EVENTS.CHAT_STOP_TYPING,    onStopTyping);
    socket.on(SOCKET_EVENTS.CALL_END,            onCallEnd);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_POSITION,     onQueuePosition);
      socket.off(SOCKET_EVENTS.MATCH_FOUND,        onMatchFound);
      socket.off(SOCKET_EVENTS.MATCH_DISCONNECTED, onMatchDisconnected);
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
