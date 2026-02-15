// ============================================
// FILE 6: src/websocket/handlers/signalHandler.ts
// ============================================
import { Server, Socket } from 'socket.io';
import { WSEvents, CallOfferPayload, CallAnswerPayload, CallIceCandidatePayload } from '../types/events';
import { SocketManager } from '../socketManager';
import sessionManager from '../../services/matching/sessionManager';
import { logger } from '../../utils/logger';

export const setupSignalHandler = (io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId } = socket.data;

  // Handle WebRTC offer
  socket.on(WSEvents.CALL_OFFER, async (payload: CallOfferPayload) => {
    try {
      const { offer } = payload;

      const partnerId = await sessionManager.getSessionPartner(userId);
      if (!partnerId) {
        socket.emit(WSEvents.CALL_ERROR, { message: 'No active session' });
        return;
      }

      socketManager.emitToUser(partnerId, WSEvents.CALL_OFFER, {
        offer,
        senderId: userId,
      });

      logger.debug(`WebRTC offer sent from ${userId} to ${partnerId}`);
    } catch (error) {
      logger.error('Error handling call offer:', error);
      socket.emit(WSEvents.CALL_ERROR, { message: 'Failed to send offer' });
    }
  });

  // Handle WebRTC answer
  socket.on(WSEvents.CALL_ANSWER, async (payload: CallAnswerPayload) => {
    try {
      const { answer } = payload;

      const partnerId = await sessionManager.getSessionPartner(userId);
      if (!partnerId) {
        socket.emit(WSEvents.CALL_ERROR, { message: 'No active session' });
        return;
      }

      socketManager.emitToUser(partnerId, WSEvents.CALL_ANSWER, {
        answer,
        senderId: userId,
      });

      logger.debug(`WebRTC answer sent from ${userId} to ${partnerId}`);
    } catch (error) {
      logger.error('Error handling call answer:', error);
      socket.emit(WSEvents.CALL_ERROR, { message: 'Failed to send answer' });
    }
  });

  // Handle ICE candidate
  socket.on(WSEvents.CALL_ICE_CANDIDATE, async (payload: CallIceCandidatePayload) => {
    try {
      const { candidate } = payload;

      const partnerId = await sessionManager.getSessionPartner(userId);
      if (!partnerId) {
        return; // Silently ignore if no partner
      }

      socketManager.emitToUser(partnerId, WSEvents.CALL_ICE_CANDIDATE, {
        candidate,
        senderId: userId,
      });
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
    }
  });

  // Handle call end
  socket.on(WSEvents.CALL_END, async () => {
    try {
      const partnerId = await sessionManager.getSessionPartner(userId);
      if (partnerId) {
        socketManager.emitToUser(partnerId, WSEvents.CALL_END, { userId });
      }

      // End session
      await sessionManager.endSessionForUser(userId);

      logger.debug(`Call ended by ${userId}`);
    } catch (error) {
      logger.error('Error handling call end:', error);
    }
  });
};