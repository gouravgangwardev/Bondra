// src/server.ts
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { ENV, printConfig } from './config/environment';
import { logger } from './utils/logger';
import { testConnection, closePool } from './config/database';
import { testRedisConnection, closeRedis, getSocketIORedisAdapter } from './config/redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { initializeMonitoring } from './config/monitoring';
import LoadBalancer from './services/matching/loadBalancer';
import pairingEngine from './services/matching/pairingEngine';
import sessionManager from './services/matching/sessionManager';
import queueManager from './services/matching/queueManager';
import { initializeSocketHandlers } from './socket/index';

class Server {
  private httpServer: http.Server;
  private io: SocketIOServer;
  private loadBalancer: LoadBalancer;
  private readonly PORT: number;
  private readonly HOST: string;

  constructor() {
    this.PORT = ENV.PORT;
    this.HOST = ENV.HOST;
    this.httpServer = http.createServer(app);
    this.loadBalancer = new LoadBalancer();
    
    // Initialize Socket.IO
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: ENV.CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: ENV.WS_PING_TIMEOUT,
      pingInterval: ENV.WS_PING_INTERVAL,
      maxHttpBufferSize: ENV.WS_MAX_BUFFER_SIZE,
      perMessageDeflate: false, // Disable compression for better performance
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const connected = await testConnection();
      if (!connected) {
        throw new Error('Database connection failed');
      }
      logger.info('✓ Database connected successfully');
    } catch (error) {
      logger.error('✗ Database connection failed:', error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const connected = await testRedisConnection();
      if (!connected) {
        throw new Error('Redis connection failed');
      }
      logger.info('✓ Redis connected successfully');
    } catch (error) {
      logger.error('✗ Redis connection failed:', error);
      throw error;
    }
  }

  private async initializeSocketIO(): Promise<void> {
    try {
      // Set up Redis adapter for Socket.IO (for horizontal scaling)
      const adapter = getSocketIORedisAdapter();
      this.io.adapter(createAdapter(adapter.pubClient, adapter.subClient));
      
      logger.info('✓ Socket.IO Redis adapter configured');

      // Wire all Socket.IO handlers (auth middleware + match/webrtc/chat/friend)
      initializeSocketHandlers(this.io);

      // Keep load balancer connection count in sync
      this.io.on('connection', (socket) => {
        this.loadBalancer.updateConnectionCount(this.io.sockets.sockets.size);
        socket.on('disconnect', () => {
          this.loadBalancer.updateConnectionCount(this.io.sockets.sockets.size);
        });
      });

      logger.info('✓ Socket.IO initialized');
    } catch (error) {
      logger.error('✗ Socket.IO initialization failed:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      // Start load balancer
      await this.loadBalancer.start(this.PORT);
      logger.info('✓ Load balancer started');

      // Start pairing engine
      pairingEngine.start(2000); // Match every 2 seconds
      logger.info('✓ Pairing engine started');

      // Initialize monitoring
      if (ENV.ENABLE_METRICS) {
        initializeMonitoring();
        logger.info('✓ Prometheus metrics enabled');
      }

      logger.info('✓ All services initialized');
    } catch (error) {
      logger.error('✗ Service initialization failed:', error);
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        this.httpServer.close(() => {
          logger.info('✓ HTTP server closed');
        });

        // Close Socket.IO connections
        this.io.close(() => {
          logger.info('✓ Socket.IO closed');
        });

        // Stop services
        pairingEngine.stop();
        logger.info('✓ Pairing engine stopped');

        sessionManager.stopCleanupJob();
        logger.info('✓ Session manager stopped');

        await this.loadBalancer.stop();
        logger.info('✓ Load balancer stopped');

        // Close database connections
        await closePool();
        logger.info('✓ Database connections closed');

        // Close Redis connections
        await closeRedis();
        logger.info('✓ Redis connections closed');

        logger.info('✓ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('✗ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }

  private async checkHealth(): Promise<void> {
    // Periodic health check
    setInterval(async () => {
      try {
        const loadBalancerHealth = await this.loadBalancer.shouldAcceptConnection();
        if (!loadBalancerHealth) {
          logger.warn('Server is overloaded');
          await this.loadBalancer.markUnhealthy();
        } else {
          await this.loadBalancer.markHealthy();
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private startCleanupJobs(): void {
    // Clean up stale queue entries every 60 seconds
    setInterval(async () => {
      try {
        await queueManager.cleanupStaleEntries();
      } catch (error) {
        logger.error('Queue cleanup failed:', error);
      }
    }, 60000);

    // Clean up dead instances every 5 minutes
    setInterval(async () => {
      try {
        await LoadBalancer.cleanupDeadInstances();
      } catch (error) {
        logger.error('Instance cleanup failed:', error);
      }
    }, 300000);

    logger.info('✓ Cleanup jobs started');
  }

  public async start(): Promise<void> {
    try {
      // Print configuration
      printConfig();

      logger.info('🚀 Starting Random Chat Server...');
      logger.info('═══════════════════════════════════════');

      // Initialize components
      await this.initializeDatabase();
      await this.initializeRedis();
      await this.initializeSocketIO();
      await this.initializeServices();

      // Start server
      this.httpServer.listen(this.PORT, this.HOST, () => {
        logger.info('═══════════════════════════════════════');
        logger.info(`✓ Server running on ${this.HOST}:${this.PORT}`);
        logger.info(`✓ Environment: ${ENV.NODE_ENV}`);
        logger.info(`✓ WebSocket: Enabled`);
        logger.info(`✓ Metrics: ${ENV.ENABLE_METRICS ? `http://localhost:${ENV.PORT}/metrics` : 'Disabled'}`);
        logger.info('═══════════════════════════════════════');
        logger.info('🎉 Server is ready to accept connections!');
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start health checks
      this.checkHealth();

      // Start cleanup jobs
      this.startCleanupJobs();

    } catch (error) {
      logger.error('✗ Failed to start server:', error);
      process.exit(1);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getHttpServer(): http.Server {
    return this.httpServer;
  }
}

// Create and start server
const server = new Server();

// Export for testing
export { server };

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default server;
