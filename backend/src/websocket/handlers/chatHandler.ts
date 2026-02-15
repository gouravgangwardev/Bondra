// ============================================
// FILE 5: src/websocket/handlers/chatHandler.ts
// ============================================
import { Server, Socket } from 'socket.io';
import { WSEvents, ChatMessagePayload } from '../types/events';
import { SocketManager } from '../socketManager';
import sessionManager from '../../services/matching/sessionManager';
import { logger } from '../../utils/logger';
import { MetricsService } from '../../config/monitoring';

export const setupChatHandler = (io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId } = socket.data;

  // Handle chat message
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

      // Get partner from active session
      const partnerId = await sessionManager.getSessionPartner(userId);

      if (!partnerId) {
        socket.emit(WSEvents.ERROR, { message: 'No active session' });
        return;
      }

      // Send message to partner
      socketManager.emitToUser(partnerId, WSEvents.CHAT_MESSAGE, {
        message,
        timestamp: Date.now(),
        senderId: userId,
      });

      // Update metrics
      MetricsService.messagesSent.labels('random').inc();

      logger.debug(`Message sent from ${userId} to ${partnerId}`);
    } catch (error) {
      logger.error('Error handling chat message:', error);
      socket.emit(WSEvents.ERROR, { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
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

  // Handle stop typing indicator
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
