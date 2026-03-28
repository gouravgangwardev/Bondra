// src/websocket/socketManager.ts
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';
import presenceTracker from '../services/friends/presenceTracker';
import { SocketData } from './types/events';

// Redis key: HSET socket:user:{userId}  {socketId} "1"
const userSocketsKey = (userId: string) => `socket:user:${userId}`;

export class SocketManager {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  // Register socket for user — stored in Redis so all nodes see it
  async registerSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    try {
      // HSET with 30-minute TTL so stale entries self-expire
      await redisClient.hset(userSocketsKey(userId), socket.id, '1');
      await redisClient.expire(userSocketsKey(userId), 1800);
    } catch (err) {
      logger.error(`registerSocket Redis error for ${userId}:`, err);
    }

    await presenceTracker.setUserOnline(userId, socket.id);
    logger.debug(`Socket registered for user ${userId}: ${socket.id}`);
  }

  // Unregister socket — clean up Redis entry
  async unregisterSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    try {
      await redisClient.hdel(userSocketsKey(userId), socket.id);
      const remaining = await redisClient.hlen(userSocketsKey(userId));
      if (remaining === 0) {
        await redisClient.del(userSocketsKey(userId));
        await presenceTracker.setUserOffline(userId);
      }
    } catch (err) {
      logger.error(`unregisterSocket Redis error for ${userId}:`, err);
    }

    logger.debug(`Socket unregistered for user ${userId}: ${socket.id}`);
  }

  // Get all socket IDs for a user across ALL nodes
  async getUserSocketsAsync(userId: string): Promise<string[]> {
    try {
      const map = await redisClient.hgetall(userSocketsKey(userId));
      return map ? Object.keys(map) : [];
    } catch (err) {
      logger.error(`getUserSockets Redis error for ${userId}:`, err);
      return [];
    }
  }

  // Sync helper kept for backward-compat callers — returns empty, prefer emitToUser
  getUserSockets(userId: string): string[] {
    // Cannot do synchronous Redis lookup; callers should use emitToUser instead.
    return [];
  }

  // Check if user is connected (at least one live socket in Redis)
  async isUserConnected(userId: string): Promise<boolean> {
    try {
      const count = await redisClient.hlen(userSocketsKey(userId));
      return count > 0;
    } catch {
      return false;
    }
  }

  // Emit to ALL sockets of a user across all server nodes via Socket.IO adapter
  // With @socket.io/redis-adapter installed, io.to(socketId).emit() fans out
  // to whichever node holds that socket automatically.
  emitToUser(userId: string, event: string, data: any): void {
    // Fire-and-forget: look up socket IDs then emit via the adapter
    redisClient.hgetall(userSocketsKey(userId))
      .then((map) => {
        if (!map) return;
        Object.keys(map).forEach((socketId) => {
          this.io.to(socketId).emit(event, data);
        });
      })
      .catch((err) => {
        logger.error(`emitToUser Redis error for ${userId}:`, err);
      });
  }

  // Emit to a specific socket ID
  emitToSocket(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  // Total live connections on THIS node
  getConnectionCount(): number {
    return this.io.sockets.sockets.size;
  }

  // Stats for this node only
  getStats(): any {
    return {
      totalConnections: this.getConnectionCount(),
      note: 'uniqueUsers is now tracked in Redis, not per-node',
    };
  }
}
