// ============================================
// FILE 9: src/websocket/handlers/errorHandler.ts
// ============================================
import { Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import { MetricsService } from '../../config/monitoring';

export const setupErrorHandler = (socket: Socket) => {
  // Handle socket errors
  socket.on('error', (error: Error) => {
    logger.error(`Socket error for ${socket.data.userId}:`, error);
    MetricsService.trackError('websocket', 'socket_error');
  });

  // Handle disconnect errors
  socket.on('disconnect', (reason: string) => {
    if (reason === 'transport error' || reason === 'ping timeout') {
      logger.warn(`Socket disconnected (${reason}): ${socket.data.userId}`);
      MetricsService.trackError('websocket', 'disconnect_error');
    }
  });

  // Handle connection errors
  socket.on('connect_error', (error: Error) => {
    logger.error(`Connection error for ${socket.data.userId}:`, error);
    MetricsService.trackError('websocket', 'connect_error');
  });
};