import { logger } from './logger';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown: boolean = false;
  private httpServer?: Server;
  private socketServer?: SocketIOServer;

  constructor() {
    this.setupSignalHandlers();
  }

  // Register HTTP server
  registerHTTPServer(server: Server): void {
    this.httpServer = server;
  }

  // Register Socket.IO server
  registerSocketServer(server: SocketIOServer): void {
    this.socketServer = server;
  }

  // Add shutdown handler
  addHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
    logger.debug(`Shutdown handler registered: ${handler.name}`);
  }

  // Setup signal handlers
  private setupSignalHandlers(): void {
    // Handle SIGTERM (graceful shutdown)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown...');
      this.shutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown...');
      this.shutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.shutdown('UNHANDLED_REJECTION');
    });

    logger.info('Signal handlers registered');
  }

  // Perform graceful shutdown
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit...');
      process.exit(1);
    }

    this.isShuttingDown = true;

    logger.info('═══════════════════════════════════════');
    logger.info(`Graceful shutdown initiated (${signal})`);
    logger.info('═══════════════════════════════════════');

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();

      // Step 2: Close WebSocket connections
      await this.closeWebSockets();

      // Step 3: Execute custom handlers
      await this.executeHandlers();

      // Step 4: Close HTTP server
      await this.closeHTTPServer();

      logger.info('═══════════════════════════════════════');
      logger.info('✓ Graceful shutdown completed successfully');
      logger.info('═══════════════════════════════════════');

      process.exit(0);
    } catch (error) {
      logger.error('═══════════════════════════════════════');
      logger.error('✗ Error during shutdown:', error);
      logger.error('═══════════════════════════════════════');
      process.exit(1);
    }
  }

  private async stopAcceptingConnections(): Promise<void> {
    logger.info('1/4: Stopping new connections...');
    // HTTP server automatically stops accepting new connections when close() is called
    logger.info('✓ Stopped accepting new connections');
  }

  private async closeWebSockets(): Promise<void> {
    if (!this.socketServer) {
      logger.info('2/4: No WebSocket server to close');
      return;
    }

    logger.info('2/4: Closing WebSocket connections...');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('WebSocket close timeout, forcing...');
        resolve();
      }, 10000); // 10 second timeout

      this.socketServer?.close(() => {
        clearTimeout(timeout);
        logger.info('✓ WebSocket connections closed');
        resolve();
      });
    });
  }

  private async executeHandlers(): Promise<void> {
    logger.info(`3/4: Executing ${this.handlers.length} shutdown handlers...`);

    for (const handler of this.handlers) {
      try {
        logger.info(`  → Running: ${handler.name}`);
        
        const timeout = handler.timeout || 5000;
        await Promise.race([
          handler.handler(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Handler timeout')), timeout)
          ),
        ]);

        logger.info(`  ✓ Completed: ${handler.name}`);
      } catch (error) {
        logger.error(`  ✗ Failed: ${handler.name}`, error);
      }
    }

    logger.info('✓ All handlers executed');
  }

  private async closeHTTPServer(): Promise<void> {
    if (!this.httpServer) {
      logger.info('4/4: No HTTP server to close');
      return;
    }

    logger.info('4/4: Closing HTTP server...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.warn('HTTP server close timeout, forcing...');
        resolve();
      }, 10000); // 10 second timeout

      this.httpServer?.close((error) => {
        clearTimeout(timeout);
        if (error) {
          logger.error('Error closing HTTP server:', error);
          reject(error);
        } else {
          logger.info('✓ HTTP server closed');
          resolve();
        }
      });
    });
  }

  // Force shutdown (for emergencies)
  forceShutdown(exitCode: number = 1): void {
    logger.error('Force shutdown initiated');
    process.exit(exitCode);
  }
}

export const gracefulShutdown = new GracefulShutdown();
export default gracefulShutdown;