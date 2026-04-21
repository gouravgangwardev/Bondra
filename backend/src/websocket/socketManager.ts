// src/websocket/socketManager.ts
// Redis-backed socket routing — works across multiple server instances.
// Each user joins a Socket.IO room named `user:<userId>` on connect.
// emitToUser() uses io.to(room).emit() which the Redis adapter fans out
// to whichever server instance holds the matching socket(s).

import { Server, Socket } from 'socket.io';
import { redisClient, REDIS_KEYS } from '../config/redis';
import { logger } from '../utils/logger';
import presenceTracker from '../services/friends/presenceTracker';
import { SocketData } from './types/events';

export class SocketManager {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  // ── Registration ───────────────────────────────────────────────────────────

  async registerSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    // Join user-scoped room so emitToUser works across instances via Redis adapter
    await socket.join(`user:${userId}`);

    // Track socket→user mapping in Redis
    await redisClient.setex(
      `${REDIS_KEYS.SOCKET_USER}${socket.id}`,
      3600,
      userId
    );

    await presenceTracker.setUserOnline(userId, socket.id);
    logger.debug(`Socket registered: ${socket.id} -> user ${userId}`);
  }

  async unregisterSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    await redisClient.del(`${REDIS_KEYS.SOCKET_USER}${socket.id}`);

    // Check if user still has other sockets connected on THIS instance
    const room = this.io.sockets.adapter.rooms.get(`user:${userId}`);
    const remainingSockets = room ? room.size : 0;

    if (remainingSockets === 0) {
      await presenceTracker.setUserOffline(userId);
    }

    logger.debug(`Socket unregistered: ${socket.id} (user ${userId})`);
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  // Emit to all sockets belonging to a user — cross-instance via Redis adapter
  emitToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitToSocket(socketId: string, event: string, data: unknown): void {
    this.io.to(socketId).emit(event, data);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  isUserConnected(userId: string): boolean {
    const room = this.io.sockets.adapter.rooms.get(`user:${userId}`);
    return room !== undefined && room.size > 0;
  }

  getConnectionCount(): number {
    return this.io.sockets.sockets.size;
  }

  getStats(): Record<string, number> {
    return { totalConnections: this.getConnectionCount() };
  }
}
