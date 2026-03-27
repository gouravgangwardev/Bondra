// src/socket/handlers/matchHandler.ts
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import queueManager from '../../services/matching/queueManager';
import sessionManager from '../../services/matching/sessionManager';
import presenceTracker from '../../services/friends/presenceTracker';
import { logger } from '../../utils/logger';
import { WS_EVENTS, SessionType, UserStatus } from '../../config/constants';

export function registerMatchHandler(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  const { userId } = socket;

  // ── Join queue ──────────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.QUEUE_JOIN, async (data: { mode: SessionType }) => {
    try {
      const mode = data?.mode;

      if (!Object.values(SessionType).includes(mode)) {
        socket.emit(WS_EVENTS.QUEUE_ERROR, { message: 'Invalid mode. Use video, audio or text.' });
        return;
      }

      // User must not already be in an active session
      const activeSession = await sessionManager.getActiveSession(userId);
      if (activeSession) {
        socket.emit(WS_EVENTS.QUEUE_ERROR, { message: 'Already in an active session.' });
        return;
      }

      // Remove from any existing queue first (prevents duplicate entries)
      await queueManager.removeFromAllQueues(userId);

      const added = await queueManager.addToQueue(userId, socket.id, mode);
      if (!added) {
        socket.emit(WS_EVENTS.QUEUE_ERROR, { message: 'Could not join queue.' });
        return;
      }

      // Update presence
      await presenceTracker.setUserOnline(userId, socket.id, UserStatus.ONLINE);

      const position = await queueManager.getQueuePosition(userId, mode);
      socket.emit(WS_EVENTS.QUEUE_POSITION, { position, mode });

      logger.info(`User ${userId} joined ${mode} queue (socket ${socket.id})`);

      // Try to find a match immediately
      await attemptMatch(userId, socket.id, mode, io);
    } catch (err) {
      logger.error('QUEUE_JOIN error:', err);
      socket.emit(WS_EVENTS.QUEUE_ERROR, { message: 'Server error joining queue.' });
    }
  });

  // ── Leave queue ─────────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.QUEUE_LEAVE, async () => {
    try {
      await queueManager.removeFromAllQueues(userId);
      logger.info(`User ${userId} left queue`);
    } catch (err) {
      logger.error('QUEUE_LEAVE error:', err);
    }
  });

  // ── Skip (end current session and re-queue) ─────────────────────────────────
  socket.on(WS_EVENTS.MATCH_NEXT, async () => {
    try {
      const session = await sessionManager.getActiveSession(userId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;

      // End the session for both users
      await sessionManager.endSession(session.id);

      // Notify partner
      const partnerPresence = await presenceTracker.getUserPresence(partnerId);
      if (partnerPresence?.socketId) {
        io.to(partnerPresence.socketId).emit(WS_EVENTS.MATCH_DISCONNECTED, {
          reason: 'partner_skipped',
        });
      }

      // Re-queue the current user in the same mode
      await queueManager.addToQueue(userId, socket.id, session.sessionType);
      const position = await queueManager.getQueuePosition(userId, session.sessionType);
      socket.emit(WS_EVENTS.QUEUE_POSITION, { position, mode: session.sessionType });

      await attemptMatch(userId, socket.id, session.sessionType, io);

      logger.info(`User ${userId} skipped, re-queued for ${session.sessionType}`);
    } catch (err) {
      logger.error('MATCH_NEXT error:', err);
    }
  });

  // ── Disconnect cleanup ───────────────────────────────────────────────────────
  socket.on(WS_EVENTS.DISCONNECT, async () => {
    try {
      // Clean up queue
      await queueManager.removeFromAllQueues(userId);

      // End active session and notify partner
      const session = await sessionManager.getActiveSession(userId);
      if (session) {
        const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
        await sessionManager.endSession(session.id);

        const partnerPresence = await presenceTracker.getUserPresence(partnerId);
        if (partnerPresence?.socketId) {
          io.to(partnerPresence.socketId).emit(WS_EVENTS.MATCH_DISCONNECTED, {
            reason: 'partner_disconnected',
          });
        }
      }

      // Set user offline
      await presenceTracker.setUserOffline(userId);

      logger.info(`User ${userId} disconnected (socket ${socket.id})`);
    } catch (err) {
      logger.error('Disconnect cleanup error:', err);
    }
  });
}

// ── Internal: attempt to pair this user with a waiting partner ────────────────
export async function attemptMatch(
  userId: string,
  socketId: string,
  mode: SessionType,
  io: SocketIOServer
): Promise<void> {
  try {
    const partner = await queueManager.findMatch(userId, mode);
    if (!partner) return; // Still waiting — polling loop will retry

    // Create a session in Redis + Postgres
    const session = await sessionManager.createSession(mode, userId, partner.userId);
    if (!session) {
      // Session creation failed — put both users back
      await queueManager.addToQueue(userId, socketId, mode);
      await queueManager.addToQueue(partner.userId, partner.socketId, mode);
      return;
    }

    // Determine who makes the WebRTC offer (caller = user1 = the one who matched)
    const matchPayload = {
      sessionId: session.id,
      mode,
    };

    // Emit to both sockets
    io.to(socketId).emit(WS_EVENTS.MATCH_FOUND, {
      ...matchPayload,
      role: 'caller',   // this user creates and sends the offer
    });

    io.to(partner.socketId).emit(WS_EVENTS.MATCH_FOUND, {
      ...matchPayload,
      role: 'callee',   // this user waits for the offer
    });

    logger.info(
      `Matched: ${userId} (caller) <-> ${partner.userId} (callee) | session ${session.id} | mode ${mode}`
    );
  } catch (err) {
    logger.error('attemptMatch error:', err);
  }
}
