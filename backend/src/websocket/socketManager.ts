// ============================================
// FILE 4: src/websocket/socketManager.ts
// ============================================
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import presenceTracker from '../services/friends/presenceTracker';
import { SocketData } from './types/events';

export class SocketManager {
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  // Register socket for user
  async registerSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }

    this.userSockets.get(userId)!.add(socket.id);

    // Set user online
    await presenceTracker.setUserOnline(userId, socket.id);

    logger.debug(`Socket registered for user ${userId}: ${socket.id}`);
  }

  // Unregister socket for user
  async unregisterSocket(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);

      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        // Set user offline
        await presenceTracker.setUserOffline(userId);
      }
    }

    logger.debug(`Socket unregistered for user ${userId}: ${socket.id}`);
  }

  // Get all sockets for user
  getUserSockets(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Emit to user (all their sockets)
  emitToUser(userId: string, event: string, data: any): void {
    const socketIds = this.getUserSockets(userId);
    socketIds.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });
  }

  // Emit to specific socket
  emitToSocket(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  // Get connection count
  getConnectionCount(): number {
    return this.io.sockets.sockets.size;
  }

  // Get user count
  getUserCount(): number {
    return this.userSockets.size;
  }

  // Get stats
  getStats(): any {
    return {
      totalConnections: this.getConnectionCount(),
      uniqueUsers: this.getUserCount(),
      averageSocketsPerUser: this.getConnectionCount() / Math.max(this.getUserCount(), 1),
    };
  }
}