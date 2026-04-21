// src/websocket/wsServer.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getSocketIORedisAdapter, RedisService, REDIS_CHANNELS } from '../config/redis';
import { ENV } from '../config/environment';
import { logger } from '../utils/logger';
import { WS_EVENTS } from '../config/constants';
import { MetricsService } from '../config/monitoring';
import { SocketManager } from './socketManager';
import { WSEvents } from './types/events';

import { setupChatHandler }   from './handlers/chatHandler';
import { setupMatchHandler }  from './handlers/matchHandler';
import { setupSignalHandler } from './handlers/signalHandler';
import { setupFriendHandler } from './handlers/friendHandler';
import { setupErrorHandler }  from './handlers/errorHandler';

import { wsAuthMiddleware }      from './middleware/wsAuth';
import { wsRateLimitMiddleware } from './middleware/wsRateLimit';

export class WebSocketServer {
  private io:            SocketIOServer;
  private socketManager: SocketManager;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin:      ENV.CORS_ORIGINS,
        methods:     ['GET', 'POST'],
        credentials: true,
      },
      transports:        ['websocket', 'polling'],
      pingTimeout:       ENV.WS_PING_TIMEOUT,
      pingInterval:      ENV.WS_PING_INTERVAL,
      maxHttpBufferSize: ENV.WS_MAX_BUFFER_SIZE,
      perMessageDeflate: false,
      allowEIO3:         true,
    });

    this.socketManager = new SocketManager(this.io);

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupConnectionHandlers();
    this.subscribeToMatchEvents();

    logger.info('WebSocket server initialized');
  }

  private setupRedisAdapter(): void {
    try {
      const adapter = getSocketIORedisAdapter();
      this.io.adapter(createAdapter(adapter.pubClient, adapter.subClient));
      logger.info('Socket.IO Redis adapter configured');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
      // Do NOT continue without adapter in multi-instance mode
      throw error;
    }
  }

  private setupMiddleware(): void {
    this.io.use(wsAuthMiddleware);
    this.io.use(wsRateLimitMiddleware);
    logger.info('WebSocket middleware configured');
  }

  private setupConnectionHandlers(): void {
    this.io.on(WS_EVENTS.CONNECTION, (socket: Socket) => {
      this.handleConnection(socket).catch(err =>
        logger.error('Error in handleConnection:', err)
      );
    });
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const { userId, username } = socket.data;

    logger.info(`WebSocket connected: ${socket.id} (${username})`);

    // Register in Redis-backed room (replaces in-memory Map)
    await this.socketManager.registerSocket(socket);
    MetricsService.trackWsConnection();

    setupChatHandler(this.io, socket, this.socketManager);
    setupMatchHandler(this.io, socket, this.socketManager);
    setupSignalHandler(this.io, socket, this.socketManager);
    setupFriendHandler(this.io, socket, this.socketManager);
    setupErrorHandler(socket);

    socket.on(WS_EVENTS.DISCONNECT, () => {
      this.handleDisconnection(socket).catch(err =>
        logger.error('Error in handleDisconnection:', err)
      );
    });

    socket.emit(WS_EVENTS.AUTH_SUCCESS, {
      socketId:  socket.id,
      userId,
      username,
      timestamp: Date.now(),
    });
  }

  private async handleDisconnection(socket: Socket): Promise<void> {
    const { userId, username } = socket.data;
    logger.info(`WebSocket disconnected: ${socket.id} (${username})`);

    await this.socketManager.unregisterSocket(socket);
    MetricsService.trackWsDisconnection('normal');
    await this.cleanupUserSession(userId);
  }

  private async cleanupUserSession(userId: string): Promise<void> {
    try {
      const [queueManager, sessionManager, presenceTracker] = await Promise.all([
        import('../services/matching/queueManager').then(m => m.default),
        import('../services/matching/sessionManager').then(m => m.default),
        import('../services/friends/presenceTracker').then(m => m.default),
      ]);

      // Notify partner BEFORE destroying the session
      const activeSession = await sessionManager.getActiveSession(userId);
      if (activeSession) {
        const partnerId =
          activeSession.user1Id === userId ? activeSession.user2Id : activeSession.user1Id;
        this.socketManager.emitToUser(partnerId, WSEvents.MATCH_DISCONNECTED, {
          reason: 'Partner disconnected',
        });
        this.socketManager.emitToUser(partnerId, WSEvents.SESSION_EXPIRED, {
          reason: 'Partner disconnected',
        });
      }

      await Promise.all([
        queueManager.removeFromAllQueues(userId),
        sessionManager.endSessionForUser(userId),
        presenceTracker.setUserOffline(userId),
      ]);

      logger.debug(`Cleaned up session for user: ${userId}`);
    } catch (error) {
      logger.error('Error cleaning up user session:', error);
    }
  }

  // Bridge Redis MATCH_FOUND events → sockets (for background pairing engine)
  private subscribeToMatchEvents(): void {
    RedisService.subscribe(REDIS_CHANNELS.MATCH_FOUND, async (data: {
      sessionId:   string;
      user1Id:     string;
      user2Id:     string;
      sessionType: string;
    }) => {
      try {
        const { sessionId, user1Id, user2Id, sessionType } = data;

        const { User } = await import('../models/User');
        const [user1, user2] = await Promise.all([
          User.findById(user1Id),
          User.findById(user2Id),
        ]);

        this.socketManager.emitToUser(user1Id, WSEvents.MATCH_FOUND, {
          sessionId,
          partnerId:       user2Id,
          partnerUsername: user2?.username || 'Anonymous',
          sessionType,
          role:            'caller',
        });

        this.socketManager.emitToUser(user2Id, WSEvents.MATCH_FOUND, {
          sessionId,
          partnerId:       user1Id,
          partnerUsername: user1?.username || 'Anonymous',
          sessionType,
          role:            'callee',
        });

        logger.info(
          `Redis match bridged: ${user1Id} (caller) <-> ${user2Id} (callee) | session ${sessionId}`
        );
      } catch (error) {
        logger.error('Error bridging Redis match event to sockets:', error);
      }
    });

    logger.info('Subscribed to Redis MATCH_FOUND channel');
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getActiveConnections(): number {
    return this.socketManager.getConnectionCount();
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
