// src/socket/handlers/webrtcHandler.ts
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import sessionManager from '../../services/matching/sessionManager';
import presenceTracker from '../../services/friends/presenceTracker';
import { logger } from '../../utils/logger';
import { WS_EVENTS } from '../../config/constants';

export function registerWebRTCHandler(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  const { userId } = socket;

  // ── Offer (caller → callee) ─────────────────────────────────────────────────
  socket.on(
    WS_EVENTS.CALL_OFFER,
    async (data: { sessionId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const { sessionId, offer } = data;
        if (!sessionId || !offer) return;

        const partnerId = await getPartnerOrReject(userId, sessionId, socket);
        if (!partnerId) return;

        const partnerPresence = await presenceTracker.getUserPresence(partnerId);
        if (!partnerPresence?.socketId) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Partner not reachable.' });
          return;
        }

        io.to(partnerPresence.socketId).emit(WS_EVENTS.CALL_OFFER, { sessionId, offer });
        logger.debug(`Offer relayed: ${userId} → ${partnerId} (session ${sessionId})`);
      } catch (err) {
        logger.error('CALL_OFFER error:', err);
        socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Failed to relay offer.' });
      }
    }
  );

  // ── Answer (callee → caller) ────────────────────────────────────────────────
  socket.on(
    WS_EVENTS.CALL_ANSWER,
    async (data: { sessionId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const { sessionId, answer } = data;
        if (!sessionId || !answer) return;

        const partnerId = await getPartnerOrReject(userId, sessionId, socket);
        if (!partnerId) return;

        const partnerPresence = await presenceTracker.getUserPresence(partnerId);
        if (!partnerPresence?.socketId) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Partner not reachable.' });
          return;
        }

        io.to(partnerPresence.socketId).emit(WS_EVENTS.CALL_ANSWER, { sessionId, answer });
        logger.debug(`Answer relayed: ${userId} → ${partnerId} (session ${sessionId})`);
      } catch (err) {
        logger.error('CALL_ANSWER error:', err);
        socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Failed to relay answer.' });
      }
    }
  );

  // ── ICE candidate (both directions) ────────────────────────────────────────
  socket.on(
    WS_EVENTS.CALL_ICE_CANDIDATE,
    async (data: { sessionId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const { sessionId, candidate } = data;
        if (!sessionId || !candidate) return;

        const partnerId = await getPartnerOrReject(userId, sessionId, socket);
        if (!partnerId) return;

        const partnerPresence = await presenceTracker.getUserPresence(partnerId);
        if (partnerPresence?.socketId) {
          io.to(partnerPresence.socketId).emit(WS_EVENTS.CALL_ICE_CANDIDATE, {
            sessionId,
            candidate,
          });
        }
      } catch (err) {
        logger.error('CALL_ICE error:', err);
      }
    }
  );

  // ── Call end (either party hangs up) ────────────────────────────────────────
  socket.on(WS_EVENTS.CALL_END, async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;
      if (!sessionId) return;

      const session = await sessionManager.getSessionById(sessionId);
      if (!session) return;

      // Only participants can end their own session
      if (session.user1Id !== userId && session.user2Id !== userId) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;

      await sessionManager.endSession(sessionId);

      // Notify partner so they can clean up their media
      const partnerPresence = await presenceTracker.getUserPresence(partnerId);
      if (partnerPresence?.socketId) {
        io.to(partnerPresence.socketId).emit(WS_EVENTS.CALL_END, { sessionId });
      }

      logger.info(`Call ended by ${userId} (session ${sessionId})`);
    } catch (err) {
      logger.error('CALL_END error:', err);
    }
  });
}

// ── Helper: validate session and return partner ID ────────────────────────────
async function getPartnerOrReject(
  userId: string,
  sessionId: string,
  socket: AuthenticatedSocket
): Promise<string | null> {
  const session = await sessionManager.getSessionById(sessionId);

  if (!session) {
    socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Session not found.' });
    return null;
  }

  if (session.user1Id !== userId && session.user2Id !== userId) {
    socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Not a participant in this session.' });
    return null;
  }

  return session.user1Id === userId ? session.user2Id : session.user1Id;
}
