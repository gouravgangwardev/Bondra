// src/websocket/handlers/signalHandler.ts
//
// FIXES IN THIS FILE
// ==================
// ERROR 1 (CRITICAL) — Redis WRONGTYPE crash silently dropped every buffered ICE candidate.
//   Root cause: `redisClient.set(bufKey, '[]', ...)` created a STRING key, but
//   `rpush` / `lrange` require a LIST key.  Redis throws WRONGTYPE which was caught
//   and swallowed, so all ICE candidates from the caller were silently lost.
//
//   Fix: two separate key namespaces —
//     ICE_LOCK_KEY  → plain STRING sentinel (set/exists/del)
//     ICE_BUFFER_KEY → pure LIST          (rpush/lrange/del)
//   The EXISTS check now targets the LOCK key; RPUSH/LRANGE always target the LIST key.
//
// ERROR 5 (MEDIUM) — Race condition: ICE candidates could arrive at the server
//   before call:start_buffering had written the sentinel, causing them to bypass
//   the buffer and reach the callee before the offer had been delivered.
//
//   Fix: call:start_buffering now accepts a Socket.IO acknowledgement callback and
//   calls it after the sentinel is written.  The client (useWebRTC.ts) awaits the
//   ack before calling createOffer(), so ICE gathering cannot start until the
//   sentinel is in Redis.

import { Server, Socket } from 'socket.io';
import {
  WSEvents,
  CallOfferPayload,
  CallAnswerPayload,
  CallIceCandidatePayload,
} from '../types/events';
import { SocketManager } from '../socketManager';
import sessionManager from '../../services/matching/sessionManager';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

declare global {
  interface RTCIceCandidateInit {
    candidate?: string;
    sdpMLineIndex?: number | null;
    sdpMid?: string | null;
    usernameFragment?: string | null;
  }
}

// ── Key helpers ─────────────────────────────────────────────────────────────
// ICE_LOCK_KEY  : STRING key — sentinel that tells the ICE handler to buffer.
//                 Created by call:start_buffering; deleted by flushIceBuffer.
// ICE_BUFFER_KEY: LIST key  — stores the actual buffered candidates.
//                 Never touched by SET/GET; only by RPUSH/LRANGE/DEL.

const ICE_BUFFER_TTL = 120; // seconds

const ICE_LOCK_KEY = (sessionId: string, userId: string): string =>
  `ice:lock:${sessionId}:${userId}`;

const ICE_BUFFER_KEY = (sessionId: string, userId: string): string =>
  `ice:buffer:${sessionId}:${userId}`;

// ── Handler setup ────────────────────────────────────────────────────────────

export const setupSignalHandler = (
  _io:           Server,
  socket:        Socket,
  socketManager: SocketManager,
): void => {
  const { userId } = socket.data;

  // ── WebRTC offer ──────────────────────────────────────────────────────────

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

      logger.debug(`WebRTC offer: ${userId} -> ${partnerId}`);
    } catch (error) {
      logger.error('Error handling call offer:', error);
      socket.emit(WSEvents.CALL_ERROR, { message: 'Failed to send offer' });
    }
  });

  // ── WebRTC answer ─────────────────────────────────────────────────────────
  // Forward the answer to the caller, then flush any buffered ICE candidates
  // that the caller collected while waiting for this answer.

  socket.on(WSEvents.CALL_ANSWER, async (payload: CallAnswerPayload) => {
    try {
      const { answer } = payload;

      const session = await sessionManager.getActiveSession(userId);
      if (!session) {
        socket.emit(WSEvents.CALL_ERROR, { message: 'No active session' });
        return;
      }

      const partnerId =
        session.user1Id === userId ? session.user2Id : session.user1Id;

      socketManager.emitToUser(partnerId, WSEvents.CALL_ANSWER, {
        answer,
        senderId: userId,
      });

      // Flush buffered ICE candidates: from=caller(partnerId), to=callee(userId)
      await flushIceBuffer(session.id, partnerId, userId, socketManager);

      logger.debug(`WebRTC answer: ${userId} -> ${partnerId}`);
    } catch (error) {
      logger.error('Error handling call answer:', error);
      socket.emit(WSEvents.CALL_ERROR, { message: 'Failed to send answer' });
    }
  });

  // ── ICE candidate ─────────────────────────────────────────────────────────
  // FIX ERROR 1: check the STRING lock key for existence; push to the separate
  // LIST buffer key.  These are now different Redis keys with different types,
  // eliminating the WRONGTYPE crash.

  socket.on(WSEvents.CALL_ICE_CANDIDATE, async (payload: CallIceCandidatePayload) => {
    try {
      const { candidate } = payload;

      const session = await sessionManager.getActiveSession(userId);
      if (!session) return;

      const partnerId =
        session.user1Id === userId ? session.user2Id : session.user1Id;

      // Check the STRING sentinel — tells us the answer hasn't arrived yet.
      const lockKey      = ICE_LOCK_KEY(session.id, userId);
      const isBuffering  = await redisClient.exists(lockKey);

      if (isBuffering) {
        // Push to the LIST key — safe: it has never been touched by SET.
        const bufKey = ICE_BUFFER_KEY(session.id, userId);
        await redisClient.rpush(bufKey, JSON.stringify(candidate));
        await redisClient.expire(bufKey, ICE_BUFFER_TTL);
        logger.debug(`ICE buffered for session ${session.id} from ${userId}`);
      } else {
        // Answer already processed — forward immediately.
        socketManager.emitToUser(partnerId, WSEvents.CALL_ICE_CANDIDATE, {
          candidate,
          senderId: userId,
        });
      }
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
    }
  });

  // ── call:start_buffering ──────────────────────────────────────────────────
  // Called by the caller immediately before createOffer().
  // FIX ERROR 1: write a STRING sentinel via SET (never used as a list).
  // FIX ERROR 5: accept a Socket.IO ack callback and call it after the sentinel
  // is written so the client can be sure the buffer is active before ICE
  // gathering starts.

  socket.on(
    'call:start_buffering',
    async (payload: { sessionId: string }, ack?: () => void) => {
      try {
        const { sessionId } = payload;
        const session = await sessionManager.getSessionById(sessionId);

        if (!session || (session.user1Id !== userId && session.user2Id !== userId)) {
          // Session not found or user not a member — still ack so client
          // doesn't hang, but do not create a buffer.
          if (typeof ack === 'function') ack();
          return;
        }

        // STRING key — sentinel only.  No RPUSH/LRANGE ever touches this key.
        await redisClient.set(ICE_LOCK_KEY(sessionId, userId), '1', 'EX', ICE_BUFFER_TTL);
        logger.debug(`ICE buffer sentinel created: session=${sessionId} user=${userId}`);

        // Ack AFTER the sentinel is persisted.  The client awaits this before
        // calling createOffer(), guaranteeing the buffer exists before any ICE
        // candidate can arrive at the server.
        if (typeof ack === 'function') ack();
      } catch (error) {
        logger.error('Error initializing ICE buffer:', error);
        // Always ack to unblock the client even on error.
        if (typeof ack === 'function') ack();
      }
    },
  );

  // ── Call end ──────────────────────────────────────────────────────────────

  socket.on(WSEvents.CALL_END, async () => {
    try {
      const session = await sessionManager.getActiveSession(userId);
      if (session) {
        const partnerId =
          session.user1Id === userId ? session.user2Id : session.user1Id;

        socketManager.emitToUser(partnerId, WSEvents.CALL_END, { userId });

        // FIX ERROR 1: delete BOTH the lock keys and the list keys for both peers.
        await Promise.all([
          redisClient.del(ICE_LOCK_KEY(session.id, userId)),
          redisClient.del(ICE_LOCK_KEY(session.id, partnerId)),
          redisClient.del(ICE_BUFFER_KEY(session.id, userId)),
          redisClient.del(ICE_BUFFER_KEY(session.id, partnerId)),
        ]);
      }

      await sessionManager.endSessionForUser(userId);
      logger.debug(`Call ended by ${userId}`);
    } catch (error) {
      logger.error('Error handling call end:', error);
    }
  });
};

// ── Helper: flush buffered ICE candidates ────────────────────────────────────
// Reads from the LIST key (ICE_BUFFER_KEY) for fromUserId and forwards each
// candidate to toUserId.  Also deletes the STRING lock key so subsequent
// candidates from the same user are forwarded immediately.

async function flushIceBuffer(
  sessionId:     string,
  fromUserId:    string,
  toUserId:      string,
  socketManager: SocketManager,
): Promise<void> {
  const lockKey = ICE_LOCK_KEY(sessionId, fromUserId);
  const bufKey  = ICE_BUFFER_KEY(sessionId, fromUserId);

  try {
    // Read the LIST key — safe because the ICE handler only ever used RPUSH on it.
    const rawCandidates = await redisClient.lrange(bufKey, 0, -1);

    // Delete both keys atomically before forwarding so any new ICE candidates
    // that arrive during the flush loop bypass the buffer and go direct.
    await redisClient.del(lockKey, bufKey);

    if (rawCandidates.length === 0) {
      logger.debug(`ICE flush: no buffered candidates for session ${sessionId} from ${fromUserId}`);
      return;
    }

    for (const raw of rawCandidates) {
      try {
        const candidate = JSON.parse(raw) as RTCIceCandidateInit;
        socketManager.emitToUser(toUserId, WSEvents.CALL_ICE_CANDIDATE, {
          candidate,
          senderId: fromUserId,
        });
      } catch (parseErr) {
        logger.warn('Failed to parse buffered ICE candidate — skipping:', parseErr);
      }
    }

    logger.debug(
      `ICE flush: ${rawCandidates.length} candidates forwarded` +
      ` for session ${sessionId} (${fromUserId} -> ${toUserId})`,
    );
  } catch (error) {
    logger.error('Error flushing ICE buffer:', error);
  }
}