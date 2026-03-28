// src/websocket/handlers/chatHandler.ts
import { Server, Socket } from 'socket.io';
import { WSEvents, ChatMessagePayload } from '../types/events';
import { SocketManager } from '../socketManager';
import sessionManager from '../../services/matching/sessionManager';
import { logger } from '../../utils/logger';
import { MetricsService } from '../../config/monitoring';

export const setupChatHandler = (io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId } = socket.data;

  // Chat message
  socket.on(WSEvents.CHAT_MESSAGE, async (payload: ChatMessagePayload) => {
    try {
      const { message } = payload;

      if (!message || message.trim().length === 0) {
        socket.emit(WSEvents.ERROR, { message: 'Message cannot be empty' });
        return;
      }

      if (message.length > 1000) {
        socket.emit(WSEvents.ERROR, { message: 'Message too long (max 1000 characters)' });
        return;
      }

      const partnerId = await sessionManager.getSessionPartner(userId);
      if (!partnerId) {
        socket.emit(WSEvents.ERROR, { message: 'No active session' });
        return;
      }

      const outgoing = {
        message: message.trim(),
        timestamp: Date.now(),
        senderId: userId,
      };

      // Echo to sender so they get the server timestamp
      socket.emit(WSEvents.CHAT_MESSAGE, outgoing);
      socketManager.emitToUser(partnerId, WSEvents.CHAT_MESSAGE, outgoing);

      MetricsService.messagesSent.labels('random').inc();
      logger.debug(`Message: ${userId} → ${partnerId}`);
    } catch (error) {
      logger.error('Error handling chat message:', error);
      socket.emit(WSEvents.ERROR, { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on(WSEvents.CHAT_TYPING, async () => {
    try {
      const partnerId = await sessionManager.getSessionPartner(userId);
      if (partnerId) {
        socketManager.emitToUser(partnerId, WSEvents.CHAT_TYPING, { userId });
      }
    } catch (error) {
      logger.error('Error handling typing:', error);
    }
  });

  // Stop typing
  socket.on(WSEvents.CHAT_STOP_TYPING, async () => {
    try {
      const partnerId = await sessionManager.getSessionPartner(userId);
      if (partnerId) {
        socketManager.emitToUser(partnerId, WSEvents.CHAT_STOP_TYPING, { userId });
      }
    } catch (error) {
      logger.error('Error handling stop typing:', error);
    }
  });
};
