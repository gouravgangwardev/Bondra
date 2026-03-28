// src/websocket/wsServer.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getSocketIORedisAdapter } from '../config/redis';
import { ENV } from '../config/environment';
import { logger } from '../utils/logger';
import { WS_EVENTS } from '../config/constants';
import { MetricsService } from '../config/monitoring';
import { SocketManager } from './socketManager';

// Import handlers
import { setupChatHandler } from './handlers/chatHandler';
import { setupMatchHandler } from './handlers/matchHandler';
import { setupSignalHandler } from './handlers/signalHandler';
import { setupFriendHandler } from './handlers/friendHandler';
import { setupErrorHandler } from './handlers/errorHandler';

// Import middleware
import { wsAuthMiddleware } from './middleware/wsAuth';
import { wsRateLimitMiddleware } from './middleware/wsRateLimit';

export class WebSocketServer {
  private io: SocketIOServer;
  private socketManager: SocketManager;
  private activeConnections: Map<string, Socket> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ENV.CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: ENV.WS_PING_TIMEOUT,
      pingInterval: ENV.WS_PING_INTERVAL,
      maxHttpBufferSize: ENV.WS_MAX_BUFFER_SIZE,
      perMessageDeflate: false,
      allowEIO3: true,
    });

    this.socketManager = new SocketManager(this.io);

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupConnectionHandlers();

    logger.info('WebSocket server initialized');
  }

  private setupRedisAdapter(): void {
    try {
      const adapter = getSocketIORedisAdapter();
      this.io.adapter(createAdapter(adapter.pubClient, adapter.subClient));
      logger.info('Socket.IO Redis adapter configured');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
    }
  }

  private setupMiddleware(): void {
    this.io.use(wsAuthMiddleware);
    this.io.use(wsRateLimitMiddleware);
    logger.info('WebSocket middleware configured');
  }

  private setupConnectionHandlers(): void {
    this.io.on(WS_EVENTS.CONNECTION, (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId;
    const username = socket.data.username;

    logger.info(`WebSocket connected: ${socket.id} (User: ${username})`);

    this.activeConnections.set(socket.id, socket);
    this.socketManager.registerSocket(socket);
    MetricsService.trackWsConnection();

    this.setupSocketHandlers(socket);

    socket.on(WS_EVENTS.DISCONNECT, () => {
      this.handleDisconnection(socket);
    });

    socket.emit(WS_EVENTS.AUTH_SUCCESS, {
      socketId: socket.id,
      userId,
      username,
      timestamp: Date.now(),
    });
  }

  private setupSocketHandlers(socket: Socket): void {
    try {
      setupChatHandler(this.io, socket, this.socketManager);
      setupMatchHandler(this.io, socket, this.socketManager);
      setupSignalHandler(this.io, socket, this.socketManager);
      setupFriendHandler(this.io, socket, this.socketManager);
      setupErrorHandler(socket);
      logger.debug(`Handlers setup for socket: ${socket.id}`);
    } catch (error) {
      logger.error('Error setting up socket handlers:', error);
    }
  }

  private handleDisconnection(socket: Socket): void {
    const userId = socket.data.userId;
    const username = socket.data.username;

    logger.info(`WebSocket disconnected: ${socket.id} (User: ${username})`);

    this.activeConnections.delete(socket.id);
    this.socketManager.unregisterSocket(socket);
    MetricsService.trackWsDisconnection('normal');
    this.cleanupUserSession(userId);
  }

  private async cleanupUserSession(userId: string): Promise<void> {
    try {
      const queueManager = (await import('../services/matching/queueManager')).default;
      const sessionManager = (await import('../services/matching/sessionManager')).default;
      const presenceTracker = (await import('../services/friends/presenceTracker')).default;

      await queueManager.removeFromAllQueues(userId);
      await sessionManager.endSessionForUser(userId);
      await presenceTracker.setUserOffline(userId);

      logger.debug(`Cleaned up session for user: ${userId}`);
    } catch (error) {
      logger.error('Error cleaning up user session:', error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getActiveConnections(): number {
    return this.activeConnections.size;
  }

  public async close(): Promise<void> {
    logger.info('Closing WebSocket server...');
    this.io.disconnectSockets();
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}

export default WebSocketServer;
