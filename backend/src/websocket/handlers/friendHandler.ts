// src/websocket/handlers/friendHandler.ts
import { Server, Socket } from 'socket.io';
import { WSEvents, FriendCallPayload } from '../types/events';
import { SocketManager } from '../socketManager';
import { FriendService } from '../../services/friends/friendService';
import presenceTracker from '../../services/friends/presenceTracker';
import pairingEngine from '../../services/matching/pairingEngine';
import { logger } from '../../utils/logger';
import { SessionType } from '../../config/constants';

export const setupFriendHandler = (io: Server, socket: Socket, socketManager: SocketManager) => {
  const { userId, username } = socket.data;

  // Friend call
  socket.on(WSEvents.FRIEND_CALL, async (payload: FriendCallPayload) => {
    try {
      const { friendId, type } = payload;

      const areFriends = await FriendService.areFriends(userId, friendId);
      if (!areFriends) {
        socket.emit(WSEvents.ERROR, { message: 'Not friends with this user' });
        return;
      }

      const isOnline = await presenceTracker.isUserOnline(friendId);
      if (!isOnline) {
        socket.emit(WSEvents.ERROR, { message: 'Friend is offline' });
        return;
      }

      const result = await pairingEngine.matchWithFriend(userId, friendId, type as SessionType);

      if (!result.success) {
        socket.emit(WSEvents.ERROR, { message: result.error });
        return;
      }

      const callData = {
        sessionId: result.sessionId,
        callerId: userId,
        callerUsername: username,
        sessionType: type,
      };

      socket.emit(WSEvents.MATCH_FOUND, { ...callData, role: 'caller' });
      socketManager.emitToUser(friendId, WSEvents.MATCH_FOUND, { ...callData, role: 'callee' });

      logger.info(`Friend call: ${userId} → ${friendId} (${type})`);
    } catch (error) {
      logger.error('Error handling friend call:', error);
      socket.emit(WSEvents.ERROR, { message: 'Failed to call friend' });
    }
  });

  // Friend list with online status
  socket.on(WSEvents.FRIEND_LIST, async () => {
    try {
      const friends = await FriendService.getFriendList(userId);

      const friendsWithStatus = await Promise.all(
        friends.map(async (friend) => {
          const friendUserId = friend.user_id === userId ? friend.friend_id : friend.user_id;
          const isOnline = await presenceTracker.isUserOnline(friendUserId);
          return { ...friend, isOnline };
        })
      );

      socket.emit(WSEvents.FRIEND_LIST, { friends: friendsWithStatus });
    } catch (error) {
      logger.error('Error handling friend list:', error);
      socket.emit(WSEvents.ERROR, { message: 'Failed to get friend list' });
    }
  });

  // Notify friends this user just came online
  presenceTracker.setUserOnline(userId, socket.id).then(async () => {
    try {
      const friends = await FriendService.getFriendList(userId);
      friends.forEach((friend) => {
        const friendUserId = friend.user_id === userId ? friend.friend_id : friend.user_id;
        socketManager.emitToUser(friendUserId, WSEvents.FRIEND_ONLINE, { userId, username });
      });
    } catch (error) {
      logger.error('Error notifying friends of online status:', error);
    }
  });
};
