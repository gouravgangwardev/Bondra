// src/socket/index.ts
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/socketAuth';
import { registerMatchHandler, attemptMatch } from './handlers/matchHandler';
import { registerWebRTCHandler } from './handlers/webrtcHandler';
import { registerChatHandler } from './handlers/chatHandler';
import { registerFriendHandler } from './handlers/friendHandler';
import presenceTracker from '../services/friends/presenceTracker';
import queueManager from '../services/matching/queueManager';
import { logger } from '../utils/logger';
import { WS_EVENTS, SessionType, UserStatus } from '../config/constants';

// Called once from server.ts after Socket.IO is created
export function initializeSocketHandlers(io: SocketIOServer): void {

  // ── Auth middleware (runs before every connection) ──────────────────────────
  io.use(socketAuthMiddleware);

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on(WS_EVENTS.CONNECTION, async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, username } = socket;

    logger.info(`Socket connected: ${socket.id} | user ${userId} (${username})`);

    // Mark user online and store socket→user mapping in Redis
    await presenceTracker.setUserOnline(userId, socket.id, UserStatus.ONLINE);

    // Broadcast updated online count to everyone
    const onlineCount = await presenceTracker.getOnlineUsersCount();
    io.emit(WS_EVENTS.USER_COUNT, { count: onlineCount });

    // ── Register all domain handlers ──────────────────────────────────────────
    registerMatchHandler(socket, io);
    registerWebRTCHandler(socket, io);
    registerChatHandler(socket, io);
    registerFriendHandler(socket, io);

    // ── Report user (from within a session) ───────────────────────────────────
    socket.on(WS_EVENTS.REPORT_USER, async (data: {
      reportedUserId: string;
      sessionId: string;
      reason: string;
    }) => {
      try {
        // Delegate to HTTP layer — just acknowledge here
        socket.emit(WS_EVENTS.REPORT_SUCCESS, { reported: data.reportedUserId });
        logger.info(`Report received: ${userId} reported ${data.reportedUserId}`);
      } catch (err) {
        logger.error('REPORT_USER error:', err);
        socket.emit(WS_EVENTS.REPORT_ERROR, { message: 'Could not submit report.' });
      }
    });
  });

  // ── Background pairing loop ──────────────────────────────────────────────────
  // Every 2 seconds try to match any waiting users across all queue types.
  // This catches users who joined the queue but didn't find an immediate peer.
  const QUEUE_TYPES: SessionType[] = [SessionType.VIDEO, SessionType.AUDIO, SessionType.TEXT];

  setInterval(async () => {
    for (const mode of QUEUE_TYPES) {
      try {
        const size = await queueManager.getQueueSize(mode);
        if (size < 2) continue;

        // Grab the oldest waiting user and try to match them
        const allInQueue = await queueManager.getQueueStats();
        // Process up to floor(size/2) pairs per tick
        const pairs = Math.floor(size / 2);
        for (let i = 0; i < pairs; i++) {
          // Get current oldest user in this queue
          const oldest = await queueManager.getOldestInQueue(mode);
          if (!oldest) break;

          await attemptMatch(oldest.userId, oldest.socketId, mode, io);
        }
      } catch (err) {
        logger.error(`Queue loop error (${mode}):`, err);
      }
    }
  }, 2000);

  logger.info('✓ Socket handlers initialized');
}
