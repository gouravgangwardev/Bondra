// ============================================
// FILE 1: src/websocket/wsServer.ts
// ============================================
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getSocketIORedisAdapter } from '../config/redis';
import { ENV } from '../config/environment';
import { logger } from '../utils/logger';
import { WS_EVENTS } from '../config/constants';
import { MetricsService } from '../config/monitoring';

// Import handlers
import { setupChatHandlers } from './handlers/chatHandler';
import { setupMatchHandlers } from './handlers/matchHandler';
import { setupSignalHandlers } from './handlers/signalHandler';
import { setupFriendHandlers } from './handlers/friendHandler';
import { setupErrorHandlers } from './handlers/errorHandler';

// Import middleware
import { wsAuthMiddleware } from './middleware/wsAuth';
import { wsRateLimitMiddleware } from './middleware/wsRateLimit';

export class WebSocketServer {
  private io: SocketIOServer;
  private activeConnections: Map<string, Socket> = new Map();

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.IO
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
      perMessageDeflate: false, // Disable for performance
      allowEIO3: true, // Support older clients
    });

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
    // Authentication middleware
    this.io.use(wsAuthMiddleware);

    // Rate limiting middleware
    this.io.use(wsRateLimitMiddleware);

    logger.info('WebSocket middleware configured');
  }

  private setupConnectionHandlers(): void {
    this.io.on(WS_EVENTS.CONNECTION, (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const userId = (socket as any).userId;
    const username = (socket as any).username;

    logger.info(`WebSocket connected: ${socket.id} (User: ${username})`);

    // Store connection
    this.activeConnections.set(socket.id, socket);

    // Update metrics
    MetricsService.trackWsConnection();

    // Setup event handlers for this socket
    this.setupSocketHandlers(socket);

    // Handle disconnection
    socket.on(WS_EVENTS.DISCONNECT, () => {
      this.handleDisconnection(socket);
    });

    // Send connection success
    socket.emit(WS_EVENTS.AUTH_SUCCESS, {
      socketId: socket.id,
      userId,
      username,
      timestamp: Date.now(),
    });
  }

  private setupSocketHandlers(socket: Socket): void {
    try {
      // Setup all handlers
      setupChatHandlers(socket, this.io);
      setupMatchHandlers(socket, this.io);
      setupSignalHandlers(socket, this.io);
      setupFriendHandlers(socket, this.io);
      setupErrorHandlers(socket, this.io);

      logger.debug(`Handlers setup for socket: ${socket.id}`);
    } catch (error) {
      logger.error('Error setting up socket handlers:', error);
    }
  }

  private handleDisconnection(socket: Socket): void {
    const userId = (socket as any).userId;
    const username = (socket as any).username;

    logger.info(`WebSocket disconnected: ${socket.id} (User: ${username})`);

    // Remove connection
    this.activeConnections.delete(socket.id);

    // Update metrics
    MetricsService.trackWsDisconnection('normal');

    // Cleanup user session, queue, etc.
    this.cleanupUserSession(userId);
  }

  private async cleanupUserSession(userId: string): Promise<void> {
    try {
      // Import services dynamically to avoid circular dependencies
      const queueManager = (await import('../services/matching/queueManager')).default;
      const sessionManager = (await import('../services/matching/sessionManager')).default;
      const presenceTracker = (await import('../services/friends/presenceTracker')).default;

      // Remove from queues
      await queueManager.removeFromAllQueues(userId);

      // End active session
      await sessionManager.endSessionForUser(userId);

      // Update presence
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
    
    // Disconnect all clients
    this.io.disconnectSockets();
    
    // Close server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}

export default WebSocketServer;