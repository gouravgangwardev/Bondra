// src/server.ts
import http from 'http';
import app from './app';
import { ENV, printConfig } from './config/environment';
import { logger } from './utils/logger';
import { testConnection, closePool } from './config/database';
import { testRedisConnection, closeRedis } from './config/redis';
import { initializeMonitoring } from './config/monitoring';
import LoadBalancer from './services/matching/loadBalancer';
import pairingEngine from './services/matching/pairingEngine';
import sessionManager from './services/matching/sessionManager';
import queueManager from './services/matching/queueManager';
import { WebSocketServer } from './websocket/wsServer';

class Server {
  private httpServer: http.Server;
  private wsServer: WebSocketServer;
  private loadBalancer: LoadBalancer;
  private readonly PORT: number;
  private readonly HOST: string;

  constructor() {
    this.PORT = ENV.PORT;
    this.HOST = ENV.HOST;
    this.httpServer = http.createServer(app);
    this.loadBalancer = new LoadBalancer();
    // WebSocketServer creates its own Socket.IO instance, attaches Redis adapter,
    // wires auth + rate-limit middleware, and registers all handlers
    this.wsServer = new WebSocketServer(this.httpServer);
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const connected = await testConnection();
      if (!connected) throw new Error('Database connection failed');
      logger.info('✓ Database connected successfully');
    } catch (error) {
      logger.error('✗ Database connection failed:', error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const connected = await testRedisConnection();
      if (!connected) throw new Error('Redis connection failed');
      logger.info('✓ Redis connected successfully');
    } catch (error) {
      logger.error('✗ Redis connection failed:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.loadBalancer.start(this.PORT);
      logger.info('✓ Load balancer started');

      pairingEngine.start(2000);
      logger.info('✓ Pairing engine started');

      if (ENV.ENABLE_METRICS) {
        initializeMonitoring();
        logger.info('✓ Prometheus metrics enabled');
      }

      // Keep load balancer connection count in sync
      const io = this.wsServer.getIO();
      io.on('connection', (socket) => {
        this.loadBalancer.updateConnectionCount(io.sockets.sockets.size);
        socket.on('disconnect', () => {
          this.loadBalancer.updateConnectionCount(io.sockets.sockets.size);
        });
      });

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
        this.httpServer.close(() => logger.info('✓ HTTP server closed'));
        await this.wsServer.close();

        pairingEngine.stop();
        logger.info('✓ Pairing engine stopped');

        sessionManager.stopCleanupJob();
        logger.info('✓ Session manager stopped');

        await this.loadBalancer.stop();
        logger.info('✓ Load balancer stopped');

        await closePool();
        logger.info('✓ Database connections closed');

        await closeRedis();
        logger.info('✓ Redis connections closed');

        logger.info('✓ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('✗ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
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
    setInterval(async () => {
      try {
        const healthy = await this.loadBalancer.shouldAcceptConnection();
        if (!healthy) {
          logger.warn('Server is overloaded');
          await this.loadBalancer.markUnhealthy();
        } else {
          await this.loadBalancer.markHealthy();
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);
  }

  private startCleanupJobs(): void {
    setInterval(async () => {
      try { await queueManager.cleanupStaleEntries(); }
      catch (error) { logger.error('Queue cleanup failed:', error); }
    }, 60000);

    setInterval(async () => {
      try { await LoadBalancer.cleanupDeadInstances(); }
      catch (error) { logger.error('Instance cleanup failed:', error); }
    }, 300000);

    logger.info('✓ Cleanup jobs started');
  }

  public async start(): Promise<void> {
    try {
      printConfig();
      logger.info('🚀 Starting Random Chat Server...');
      logger.info('═══════════════════════════════════════');

      await this.initializeDatabase();
      await this.initializeRedis();
      await this.initializeServices();

      this.httpServer.listen(this.PORT, this.HOST, () => {
        logger.info('═══════════════════════════════════════');
        logger.info(`✓ Server running on ${this.HOST}:${this.PORT}`);
        logger.info(`✓ Environment: ${ENV.NODE_ENV}`);
        logger.info(`✓ WebSocket: Enabled`);
        logger.info(`✓ Metrics: ${ENV.ENABLE_METRICS ? `http://localhost:${ENV.PORT}/metrics` : 'Disabled'}`);
        logger.info('═══════════════════════════════════════');
        logger.info('🎉 Server is ready to accept connections!');
      });

      this.setupGracefulShutdown();
      this.checkHealth();
      this.startCleanupJobs();
    } catch (error) {
      logger.error('✗ Failed to start server:', error);
      process.exit(1);
    }
  }

  public getHttpServer(): http.Server {
    return this.httpServer;
  }

  public getIO() {
    return this.wsServer.getIO();
  }
}

const server = new Server();
export { server };

if (process.env.NODE_ENV !== 'test') {
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default server;
