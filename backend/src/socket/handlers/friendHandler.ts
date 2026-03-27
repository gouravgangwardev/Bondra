// src/socket/handlers/friendHandler.ts
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import { FriendService } from '../../services/friends/friendService';
import presenceTracker from '../../services/friends/presenceTracker';
import sessionManager from '../../services/matching/sessionManager';
import { Friendship } from '../../models/Friendship';
import { logger } from '../../utils/logger';
import { WS_EVENTS, SessionType, FriendshipStatus, UserStatus } from '../../config/constants';

export function registerFriendHandler(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  const { userId } = socket;

  // ── Send friend request ──────────────────────────────────────────────────────
  socket.on(WS_EVENTS.FRIEND_REQUEST_SEND, async (data: { friendId: string }) => {
    try {
      const { friendId } = data;
      if (!friendId) return;

      const result = await FriendService.sendFriendRequest(userId, friendId);

      if (!result.success) {
        socket.emit(WS_EVENTS.FRIEND_REQUEST_SEND, { error: result.error });
        return;
      }

      // Notify the target user in real-time if they're online
      const targetPresence = await presenceTracker.getUserPresence(friendId);
      if (targetPresence?.socketId) {
        io.to(targetPresence.socketId).emit(WS_EVENTS.FRIEND_REQUEST_RECEIVED, {
          fromUserId: userId,
          fromUsername: socket.username,
        });
      }

      socket.emit(WS_EVENTS.FRIEND_REQUEST_SEND, { success: true, friendId });
      logger.info(`Friend request: ${userId} → ${friendId}`);
    } catch (err) {
      logger.error('FRIEND_REQUEST_SEND error:', err);
      socket.emit(WS_EVENTS.FRIEND_REQUEST_SEND, { error: 'Server error.' });
    }
  });

  // ── Accept friend request ────────────────────────────────────────────────────
  socket.on(WS_EVENTS.FRIEND_REQUEST_ACCEPT, async (data: { requesterId: string }) => {
    try {
      const { requesterId } = data;
      if (!requesterId) return;

      const result = await FriendService.acceptFriendRequest(userId, requesterId);

      if (!result.success) {
        socket.emit(WS_EVENTS.FRIEND_REQUEST_ACCEPT, { error: result.error });
        return;
      }

      // Tell the original requester their request was accepted
      const requesterPresence = await presenceTracker.getUserPresence(requesterId);
      if (requesterPresence?.socketId) {
        io.to(requesterPresence.socketId).emit(WS_EVENTS.FRIEND_REQUEST_ACCEPT, {
          friendId: userId,
          friendUsername: socket.username,
        });
      }

      socket.emit(WS_EVENTS.FRIEND_REQUEST_ACCEPT, { success: true, friendId: requesterId });
      logger.info(`Friend request accepted: ${userId} ← ${requesterId}`);
    } catch (err) {
      logger.error('FRIEND_REQUEST_ACCEPT error:', err);
      socket.emit(WS_EVENTS.FRIEND_REQUEST_ACCEPT, { error: 'Server error.' });
    }
  });

  // ── Reject friend request ────────────────────────────────────────────────────
  socket.on(WS_EVENTS.FRIEND_REQUEST_REJECT, async (data: { requesterId: string }) => {
    try {
      const { requesterId } = data;
      if (!requesterId) return;

      await FriendService.rejectFriendRequest(userId, requesterId);
      socket.emit(WS_EVENTS.FRIEND_REQUEST_REJECT, { success: true });
    } catch (err) {
      logger.error('FRIEND_REQUEST_REJECT error:', err);
    }
  });

  // ── Initiate call to a friend ────────────────────────────────────────────────
  socket.on(
    WS_EVENTS.FRIEND_CALL,
    async (data: { friendId: string; mode: SessionType }) => {
      try {
        const { friendId, mode } = data;
        if (!friendId || !mode) return;

        // Verify they are actually friends
        const friendship = await Friendship.findFriendship(userId, friendId);
        if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Not friends.' });
          return;
        }

        // Check neither user is already in a session
        const [callerSession, calleeSession] = await Promise.all([
          sessionManager.getActiveSession(userId),
          sessionManager.getActiveSession(friendId),
        ]);

        if (callerSession || calleeSession) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'User already in a session.' });
          return;
        }

        const friendPresence = await presenceTracker.getUserPresence(friendId);
        if (!friendPresence?.socketId) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Friend is offline.' });
          return;
        }

        // Create session directly (no queue for friends)
        const session = await sessionManager.createSession(mode, userId, friendId);
        if (!session) {
          socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Could not start session.' });
          return;
        }

        // Caller gets 'caller' role, friend gets 'callee' role
        socket.emit(WS_EVENTS.MATCH_FOUND, {
          sessionId: session.id,
          mode,
          role: 'caller',
          isFriendCall: true,
          friendId,
        });

        io.to(friendPresence.socketId).emit(WS_EVENTS.MATCH_FOUND, {
          sessionId: session.id,
          mode,
          role: 'callee',
          isFriendCall: true,
          friendId: userId,
          friendUsername: socket.username,
        });

        logger.info(`Friend call: ${userId} → ${friendId} | mode ${mode} | session ${session.id}`);
      } catch (err) {
        logger.error('FRIEND_CALL error:', err);
        socket.emit(WS_EVENTS.CALL_ERROR, { message: 'Server error.' });
      }
    }
  );

  // ── Get online friends ────────────────────────────────────────────────────────
  socket.on(WS_EVENTS.FRIEND_LIST, async () => {
    try {
      const friends = await FriendService.getOnlineFriends(userId);
      socket.emit(WS_EVENTS.FRIEND_LIST, { friends });
    } catch (err) {
      logger.error('FRIEND_LIST error:', err);
    }
  });
}
