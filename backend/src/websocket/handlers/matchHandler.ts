// src/websocket/handlers/matchHandler.ts
//
// FIXES IN THIS FILE
// ==================
// TS WARNING (ts6133): 'io' is declared but its value is never read. [Ln 58, Col 35]
//   The setupMatchHandler function signature receives `io: Server` as its first
//   parameter (to match the convention used by other handlers), but matchHandler
//   never calls io.to() or io.emit() directly — all routing goes through
//   socketManager or the per-socket `socket` reference.
//   Fix: prefix with underscore → `_io` to signal intentional non-use.
//   This suppresses ts6133 without disabling the rule globally.
//
// ERROR 1 (previous): MATCH_NEXT deletes ICE lock/buffer keys after endSession()
//   so no late-arriving ICE candidates are silently buffered into an orphaned list.
//
// ERROR 4 (previous): MATCH_NEXT accepts payload { type? } as fallback when
//   the Redis session has expired mid-session.
//
// RACE CONDITION FIX: After quickMatch() returns { success: false }, check
//   whether the background processQueue() already matched this user before
//   emitting QUEUE_POSITION. Emitting QUEUE_POSITION when the user has just
//   been matched by the background loop sends a contradictory signal and can
//   cause the client to display "waiting" while a MATCH_FOUND event is already
//   in-flight from the Redis subscriber path.

import { Server, Socket } from 'socket.io';
import { WSEvents, QueueJoinPayload, MatchFoundPayload } from '../types/events';
import { SocketManager } from '../socketManager';
import queueManager from '../../services/matching/queueManager';
import pairingEngine from '../../services/matching/pairingEngine';
import sessionManager from '../../services/matching/sessionManager';
import { User } from '../../models/User';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';

// Prevent "Next" from firing more than once per second per user.
const NEXT_DEBOUNCE_KEY = (userId: string) => `debounce:next:${userId}`;
const NEXT_DEBOUNCE_TTL = 1; // seconds

// ICE key helpers — must match signalHandler.ts exactly.
const ICE_LOCK_KEY   = (sessionId: string, uid: string) => `ice:lock:${sessionId}:${uid}`;
const ICE_BUFFER_KEY = (sessionId: string, uid: string) => `ice:buffer:${sessionId}:${uid}`;

const VALID_SESSION_TYPES = ['video', 'audio', 'text'] as const;
type ValidSessionType = typeof VALID_SESSION_TYPES[number];

function isValidSessionType(t: unknown): t is ValidSessionType {
  return typeof t === 'string' && (VALID_SESSION_TYPES as readonly string[]).includes(t);
}

// FIX ts6133: renamed `io` → `_io` — parameter kept for API consistency with
// other handlers (chatHandler, signalHandler, etc.) but is intentionally unused here.
export const setupMatchHandler = (_io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId, username } = socket.data;

  // ── Join queue ──────────────────────────────────────────────────────────────

  socket.on(WSEvents.QUEUE_JOIN, async (payload: QueueJoinPayload) => {
    try {
      const { type } = payload;

      if (!isValidSessionType(type)) {
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
          sessionId:       result.sessionId!,
          partnerId:       result.partner.userId,
          partnerUsername: partnerUser?.username || 'Anonymous',
          sessionType:     type,
        };

        socket.emit(WSEvents.MATCH_FOUND, { ...matchPayload, role: 'caller' });
        socketManager.emitToUser(result.partner.userId, WSEvents.MATCH_FOUND, {
          ...matchPayload,
          partnerId:       userId,
          partnerUsername: username,
          role:            'callee',
        });

        logger.info(`Match found inline: ${userId} <-> ${result.partner.userId}`);
      } else {
        // RACE CONDITION FIX: The background processQueue() may have already
        // matched this user while quickMatch() was running (and won the Redis
        // lock). In that case the user is no longer in the queue — emitting
        // QUEUE_POSITION would contradict the MATCH_FOUND coming via the Redis
        // subscriber path. Only emit QUEUE_POSITION if the user is still
        // actually waiting in the queue (position > 0).
        const position = await queueManager.getQueuePosition(userId, type as SessionType);
        if (position > 0) {
          socket.emit(WSEvents.QUEUE_POSITION, { position });
          logger.debug(`User ${userId} queued in ${type} (position: ${position})`);
        } else {
          // User was matched by the background loop — MATCH_FOUND will arrive
          // via the Redis → wsServer subscriber path. No action needed here.
          logger.debug(`User ${userId} already matched by background loop in ${type}`);
        }
      }
    } catch (error) {
      logger.error('Error handling queue join:', error);
      socket.emit(WSEvents.QUEUE_ERROR, { message: 'Failed to join queue' });
    }
  });

  // ── Leave queue ─────────────────────────────────────────────────────────────

  socket.on(WSEvents.QUEUE_LEAVE, async (payload: QueueJoinPayload) => {
    try {
      const { type } = payload;
      await pairingEngine.cancelMatching(userId, type as SessionType);
      logger.debug(`User ${userId} left ${type} queue`);
    } catch (error) {
      logger.error('Error handling queue leave:', error);
    }
  });

  // ── Next (skip to new partner) ──────────────────────────────────────────────

  socket.on(WSEvents.MATCH_NEXT, async (payload: { type?: string } = {}) => {
    try {
      const debounceKey = NEXT_DEBOUNCE_KEY(userId);
      const acquired    = await redisClient.set(debounceKey, '1', 'EX', NEXT_DEBOUNCE_TTL, 'NX');
      if (!acquired) {
        logger.debug(`Next debounced for user ${userId}`);
        return;
      }

      const session = await sessionManager.getActiveSession(userId);

      // Fallback: if session expired from Redis, re-queue via payload type.
      if (!session) {
        if (isValidSessionType(payload.type)) {
          logger.warn(`MATCH_NEXT: session not in Redis for ${userId}, re-queueing via payload type`);
          const result = await pairingEngine.quickMatch(userId, socket.id, payload.type as SessionType);
          if (result.success && result.partner) {
            const partnerUser = await User.findById(result.partner.userId);
            const matchPayload: MatchFoundPayload = {
              sessionId:       result.sessionId!,
              partnerId:       result.partner.userId,
              partnerUsername: partnerUser?.username || 'Anonymous',
              sessionType:     payload.type,
            };
            socket.emit(WSEvents.MATCH_FOUND, { ...matchPayload, role: 'caller' });
            socketManager.emitToUser(result.partner.userId, WSEvents.MATCH_FOUND, {
              ...matchPayload,
              partnerId:       userId,
              partnerUsername: username,
              role:            'callee',
            });
          } else {
            // Apply same race-condition guard as in QUEUE_JOIN
            const position = await queueManager.getQueuePosition(userId, payload.type as SessionType);
            if (position > 0) {
              socket.emit(WSEvents.QUEUE_POSITION, { position });
            }
          }
        }
        return;
      }

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;

      socketManager.emitToUser(partnerId, WSEvents.MATCH_DISCONNECTED, {
        reason: 'Partner clicked next',
      });
      socketManager.emitToUser(partnerId, WSEvents.SESSION_EXPIRED, {
        reason: 'Partner clicked next',
      });

      await sessionManager.endSession(session.id);

      // Delete ICE sentinel and buffer keys for both peers.
      await Promise.all([
        redisClient.del(ICE_LOCK_KEY(session.id, userId)),
        redisClient.del(ICE_LOCK_KEY(session.id, partnerId)),
        redisClient.del(ICE_BUFFER_KEY(session.id, userId)),
        redisClient.del(ICE_BUFFER_KEY(session.id, partnerId)),
      ]);

      const result = await pairingEngine.quickMatch(userId, socket.id, session.sessionType);

      if (result.success && result.partner) {
        const partnerUser = await User.findById(result.partner.userId);
        const matchPayload: MatchFoundPayload = {
          sessionId:       result.sessionId!,
          partnerId:       result.partner.userId,
          partnerUsername: partnerUser?.username || 'Anonymous',
          sessionType:     session.sessionType,
        };
        socket.emit(WSEvents.MATCH_FOUND, { ...matchPayload, role: 'caller' });
        socketManager.emitToUser(result.partner.userId, WSEvents.MATCH_FOUND, {
          ...matchPayload,
          partnerId:       userId,
          partnerUsername: username,
          role:            'callee',
        });
      } else {
        // Apply same race-condition guard
        const position = await queueManager.getQueuePosition(userId, session.sessionType);
        if (position > 0) {
          socket.emit(WSEvents.QUEUE_POSITION, { position });
        }
      }

      logger.debug(`User ${userId} clicked next`);
    } catch (error) {
      logger.error('Error handling match next:', error);
    }
  });
};