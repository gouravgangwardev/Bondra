// src/socket/handlers/chatHandler.ts
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import sessionManager from '../../services/matching/sessionManager';
import presenceTracker from '../../services/friends/presenceTracker';
import { logger } from '../../utils/logger';
import { WS_EVENTS, VALIDATION_RULES } from '../../config/constants';

// Simple in-memory rate limiter: max 20 messages per second per user
const messageTimestamps = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = 1000; // 1 second
  const max = 20;

  const times = (messageTimestamps.get(userId) || []).filter(t => now - t < window);
  if (times.length >= max) return true;

  times.push(now);
  messageTimestamps.set(userId, times);
  return false;
}

export function registerChatHandler(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  const { userId, username } = socket;

  // ── Send message ────────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.CHAT_MESSAGE, async (data: { sessionId: string; text: string }) => {
    try {
      const { sessionId, text } = data;

      if (!sessionId || typeof text !== 'string') return;

      // Trim and validate length
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > VALIDATION_RULES.MESSAGE.MAX_LENGTH) {
        socket.emit(WS_EVENTS.CHAT_MESSAGE, {
          error: `Message must be 1–${VALIDATION_RULES.MESSAGE.MAX_LENGTH} characters.`,
        });
        return;
      }

      // Rate limit
      if (isRateLimited(userId)) {
        socket.emit(WS_EVENTS.CHAT_MESSAGE, { error: 'Slow down.' });
        return;
      }

      const partnerId = await getPartnerOrSilentFail(userId, sessionId);
      if (!partnerId) return;

      const partnerPresence = await presenceTracker.getUserPresence(partnerId);
      if (!partnerPresence?.socketId) return;

      const message = {
        sessionId,
        senderId: userId,
        senderUsername: username,
        text: trimmed,
        timestamp: Date.now(),
      };

      // Echo back to sender (so they see their own message with server timestamp)
      socket.emit(WS_EVENTS.CHAT_MESSAGE, message);

      // Forward to partner
      io.to(partnerPresence.socketId).emit(WS_EVENTS.CHAT_MESSAGE, message);
    } catch (err) {
      logger.error('CHAT_MESSAGE error:', err);
    }
  });

  // ── Typing indicator ────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.CHAT_TYPING, async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;
      if (!sessionId) return;

      const partnerId = await getPartnerOrSilentFail(userId, sessionId);
      if (!partnerId) return;

      const partnerPresence = await presenceTracker.getUserPresence(partnerId);
      if (partnerPresence?.socketId) {
        io.to(partnerPresence.socketId).emit(WS_EVENTS.CHAT_TYPING, { userId });
      }
    } catch (err) {
      logger.error('CHAT_TYPING error:', err);
    }
  });

  // ── Stop typing ─────────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.CHAT_STOP_TYPING, async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;
      if (!sessionId) return;

      const partnerId = await getPartnerOrSilentFail(userId, sessionId);
      if (!partnerId) return;

      const partnerPresence = await presenceTracker.getUserPresence(partnerId);
      if (partnerPresence?.socketId) {
        io.to(partnerPresence.socketId).emit(WS_EVENTS.CHAT_STOP_TYPING, { userId });
      }
    } catch (err) {
      logger.error('CHAT_STOP_TYPING error:', err);
    }
  });
}

// ── Helper: returns partner ID or null if session invalid / user not in it ─────
async function getPartnerOrSilentFail(
  userId: string,
  sessionId: string
): Promise<string | null> {
  const session = await sessionManager.getSessionById(sessionId);
  if (!session) return null;
  if (session.user1Id !== userId && session.user2Id !== userId) return null;
  return session.user1Id === userId ? session.user2Id : session.user1Id;
}
