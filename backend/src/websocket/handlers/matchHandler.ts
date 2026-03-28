// src/websocket/handlers/matchHandler.ts
import { Server, Socket } from 'socket.io';
import { WSEvents, QueueJoinPayload, MatchFoundPayload } from '../types/events';
import { SocketManager } from '../socketManager';
import queueManager from '../../services/matching/queueManager';
import pairingEngine from '../../services/matching/pairingEngine';
import sessionManager from '../../services/matching/sessionManager';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';

export const setupMatchHandler = (io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId, username } = socket.data;

  // Join queue
  socket.on(WSEvents.QUEUE_JOIN, async (payload: QueueJoinPayload) => {
    try {
      const { type } = payload;

      if (!['video', 'audio', 'text'].includes(type)) {
        socket.emit(WSEvents.QUEUE_ERROR, { message: 'Invalid session type' });
        return;
      }

      const inSession = await sessionManager.isUserInSession(userId);
      if (inSession) {
        socket.emit(WSEvents.QUEUE_ERROR, { message: 'Already in active session' });
        return;
      }

      const result = await pairingEngine.quickMatch(userId, socket.id, type as SessionType);

      if (result.success && result.partner) {
        const partnerUser = await User.findById(result.partner.userId);

        const matchPayload: MatchFoundPayload = {
          sessionId: result.sessionId!,
          partnerId: result.partner.userId,
          partnerUsername: partnerUser?.username || 'Anonymous',
          sessionType: type,
        };

        // Caller role to the initiator, callee to the partner
        socket.emit(WSEvents.MATCH_FOUND, { ...matchPayload, role: 'caller' });
        socketManager.emitToUser(result.partner.userId, WSEvents.MATCH_FOUND, {
          ...matchPayload,
          partnerId: userId,
          partnerUsername: username,
          role: 'callee',
        });

        logger.info(`Match found: ${userId} <-> ${result.partner.userId}`);
      } else {
        const position = await queueManager.getQueuePosition(userId, type as SessionType);
        socket.emit(WSEvents.QUEUE_POSITION, { position });
        logger.debug(`User ${userId} added to ${type} queue (position: ${position})`);
      }
    } catch (error) {
      logger.error('Error handling queue join:', error);
      socket.emit(WSEvents.QUEUE_ERROR, { message: 'Failed to join queue' });
    }
  });

  // Leave queue
  socket.on(WSEvents.QUEUE_LEAVE, async (payload: QueueJoinPayload) => {
    try {
      const { type } = payload;
      await pairingEngine.cancelMatching(userId, type as SessionType);
      logger.debug(`User ${userId} left ${type} queue`);
    } catch (error) {
      logger.error('Error handling queue leave:', error);
    }
  });

  // Skip — end session, notify partner, re-queue for same mode
  socket.on(WSEvents.MATCH_NEXT, async () => {
    try {
      const session = await sessionManager.getActiveSession(userId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;

      socketManager.emitToUser(partnerId, WSEvents.MATCH_DISCONNECTED, {
        reason: 'Partner clicked next',
      });

      await sessionManager.endSession(session.id);

      // Re-queue the user who clicked Next
      const result = await pairingEngine.quickMatch(userId, socket.id, session.sessionType);
      if (result.success && result.partner) {
        const partnerUser = await User.findById(result.partner.userId);
        const matchPayload: MatchFoundPayload = {
          sessionId: result.sessionId!,
          partnerId: result.partner.userId,
          partnerUsername: partnerUser?.username || 'Anonymous',
          sessionType: session.sessionType,
        };
        socket.emit(WSEvents.MATCH_FOUND, { ...matchPayload, role: 'caller' });
        socketManager.emitToUser(result.partner.userId, WSEvents.MATCH_FOUND, {
          ...matchPayload,
          partnerId: userId,
          partnerUsername: username,
          role: 'callee',
        });
      } else {
        const position = await queueManager.getQueuePosition(userId, session.sessionType);
        socket.emit(WSEvents.QUEUE_POSITION, { position });
      }

      logger.debug(`User ${userId} clicked next`);
    } catch (error) {
      logger.error('Error handling match next:', error);
    }
  });
};
