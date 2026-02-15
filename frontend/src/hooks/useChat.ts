// src/hooks/useChat.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Message, MessageStatus } from '../components/chat/MessageBubble';
import { QueueType } from '../components/matching/QueueStatus';

interface MatchedUser {
  id: string;
  username: string;
  avatar?: string | null;
}

interface UseChatOptions {
  socket: Socket | null;
  userId?: string;
}

interface UseChatReturn {
  // Matching state
  isSearching: boolean;
  matchedUser: MatchedUser | null;
  sessionId: string | null;
  estimatedWaitTime: number;
  
  // Chat state
  messages: Message[];
  isPartnerTyping: boolean;
  isConnected: boolean;
  
  // Actions
  startMatching: (mode: QueueType) => void;
  cancelMatching: () => void;
  sendMessage: (content: string) => void;
  sendTyping: (isTyping: boolean) => void;
  skipPartner: () => void;
  endSession: () => void;
  reportUser: (reason: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
}

export const useChat = (options: UseChatOptions): UseChatReturn => {
  const { socket, userId } = options;

  // Matching state
  const [isSearching, setIsSearching] = useState(false);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Start matching
  const startMatching = useCallback((mode: QueueType) => {
    if (!socket || isSearching) return;

    setIsSearching(true);
    setMessages([]);
    socket.emit('matching:join-queue', { type: mode });
  }, [socket, isSearching]);

  // Cancel matching
  const cancelMatching = useCallback(() => {
    if (!socket) return;

    socket.emit('matching:leave-queue');
    setIsSearching(false);
  }, [socket]);

  // Send message
  const sendMessage = useCallback((content: string) => {
    if (!socket || !sessionId || !userId) return;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      senderId: userId,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages(prev => [...prev, tempMessage]);

    socket.emit('chat:send-message', {
      sessionId,
      content,
    });
  }, [socket, sessionId, userId]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socket || !sessionId) return;

    socket.emit('chat:typing', { sessionId, isTyping });
  }, [socket, sessionId]);

  // Skip to next partner
  const skipPartner = useCallback(() => {
    if (!socket || !sessionId) return;

    socket.emit('chat:skip', { sessionId });
    setMessages([]);
    setMatchedUser(null);
    setSessionId(null);
    setIsConnected(false);
  }, [socket, sessionId]);

  // End session
  const endSession = useCallback(() => {
    if (!socket || !sessionId) return;

    socket.emit('chat:end-session', { sessionId });
    setMessages([]);
    setMatchedUser(null);
    setSessionId(null);
    setIsConnected(false);
    setIsSearching(false);
  }, [socket, sessionId]);

  // Report user
  const reportUser = useCallback((reason: string) => {
    if (!socket || !sessionId || !matchedUser) return;

    socket.emit('chat:report', {
      sessionId,
      reportedUserId: matchedUser.id,
      reason,
    });
  }, [socket, sessionId, matchedUser]);

  // Add reaction to message
  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!socket || !sessionId) return;

    socket.emit('chat:react', {
      sessionId,
      messageId,
      emoji,
    });
  }, [socket, sessionId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Queue events
    socket.on('matching:queue-update', (data: { position: number; estimatedWaitTime: number }) => {
      setEstimatedWaitTime(data.estimatedWaitTime);
    });

    socket.on('matching:matched', (data: { sessionId: string; partner: MatchedUser }) => {
      console.log('Matched with:', data.partner);
      setIsSearching(false);
      setSessionId(data.sessionId);
      setMatchedUser(data.partner);
      setIsConnected(true);
      setMessages([
        {
          id: 'system-connected',
          content: `You are now connected with ${data.partner.username}`,
          senderId: 'system',
          timestamp: new Date(),
          type: 'system',
        },
      ]);
    });

    socket.on('matching:no-match', () => {
      setIsSearching(false);
      setEstimatedWaitTime(0);
    });

    // Chat events
    socket.on('chat:message', (data: { messageId: string; content: string; senderId: string; timestamp: string }) => {
      const newMessage: Message = {
        id: data.messageId,
        content: data.content,
        senderId: data.senderId,
        senderName: data.senderId === userId ? 'You' : matchedUser?.username,
        timestamp: new Date(data.timestamp),
        status: 'delivered',
      };

      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('chat:message-sent', (data: { tempId: string; messageId: string; timestamp: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.tempId
            ? { ...msg, id: data.messageId, timestamp: new Date(data.timestamp), status: 'sent' }
            : msg
        )
      );
    });

    socket.on('chat:message-delivered', (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId ? { ...msg, status: 'delivered' } : msg
        )
      );
    });

    socket.on('chat:message-read', (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId ? { ...msg, status: 'read' } : msg
        )
      );
    });

    socket.on('chat:typing', (data: { isTyping: boolean }) => {
      setIsPartnerTyping(data.isTyping);

      if (data.isTyping) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsPartnerTyping(false);
        }, 3000);
      }
    });

    socket.on('chat:reaction', (data: { messageId: string; emoji: string; userId: string }) => {
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === data.messageId) {
            const reactions = { ...msg.reactions };
            reactions[data.emoji] = (reactions[data.emoji] || 0) + 1;
            return { ...msg, reactions };
          }
          return msg;
        })
      );
    });

    socket.on('chat:partner-disconnected', () => {
      setMessages(prev => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          content: 'Your partner has disconnected',
          senderId: 'system',
          timestamp: new Date(),
          type: 'system',
        },
      ]);
      setIsConnected(false);
    });

    socket.on('chat:session-ended', () => {
      setMessages(prev => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          content: 'Chat session ended',
          senderId: 'system',
          timestamp: new Date(),
          type: 'system',
        },
      ]);
      setIsConnected(false);
      setSessionId(null);
      setMatchedUser(null);
    });

    // Cleanup
    return () => {
      socket.off('matching:queue-update');
      socket.off('matching:matched');
      socket.off('matching:no-match');
      socket.off('chat:message');
      socket.off('chat:message-sent');
      socket.off('chat:message-delivered');
      socket.off('chat:message-read');
      socket.off('chat:typing');
      socket.off('chat:reaction');
      socket.off('chat:partner-disconnected');
      socket.off('chat:session-ended');
      clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, userId, matchedUser]);

  return {
    isSearching,
    matchedUser,
    sessionId,
    estimatedWaitTime,
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
    addReaction,
  };
};
