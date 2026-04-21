// src/config/monitoring.ts
import * as promClient from 'prom-client';
import { logger } from '../utils/logger';
import { ENV } from './environment';

// Enable default metrics collection (CPU, memory, etc.)
const collectDefaultMetrics = promClient.collectDefaultMetrics;

// Collect metrics every 10 seconds
collectDefaultMetrics({ 
  timeout: 10000,
  prefix: 'random_chat_',
});

// Create a Registry
export const register = new promClient.Registry();

// Register default metrics
promClient.register.setDefaultLabels({
  app: 'random-chat',
  environment: ENV.NODE_ENV,
});

// Custom Metrics

// HTTP Request metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// WebSocket metrics
export const wsConnectionsTotal = new promClient.Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
});

export const wsConnectionsCreated = new promClient.Counter({
  name: 'websocket_connections_created_total',
  help: 'Total number of WebSocket connections created',
});

export const wsConnectionsClosed = new promClient.Counter({
  name: 'websocket_connections_closed_total',
  help: 'Total number of WebSocket connections closed',
  labelNames: ['reason'],
});

export const wsMessagesTotal = new promClient.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event', 'direction'], // direction: 'inbound' or 'outbound'
});

export const wsMessageDuration = new promClient.Histogram({
  name: 'websocket_message_duration_seconds',
  help: 'Duration of WebSocket message processing',
  labelNames: ['event'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Queue metrics
export const queueSize = new promClient.Gauge({
  name: 'queue_size',
  help: 'Current size of matching queues',
  labelNames: ['type'], // type: 'video', 'audio', 'text'
});

export const queueWaitTime = new promClient.Histogram({
  name: 'queue_wait_time_seconds',
  help: 'Time users spend waiting in queue',
  labelNames: ['type'],
  buckets: [1, 5, 10, 15, 30, 60, 120],
});

export const queueJoinTotal = new promClient.Counter({
  name: 'queue_join_total',
  help: 'Total number of queue joins',
  labelNames: ['type'],
});

export const queueLeaveTotal = new promClient.Counter({
  name: 'queue_leave_total',
  help: 'Total number of queue leaves',
  labelNames: ['type', 'reason'], // reason: 'matched', 'timeout', 'cancelled'
});

// Matching metrics
export const matchesTotal = new promClient.Counter({
  name: 'matches_total',
  help: 'Total number of successful matches',
  labelNames: ['type'],
});

export const matchesFailed = new promClient.Counter({
  name: 'matches_failed_total',
  help: 'Total number of failed matches',
  labelNames: ['type', 'reason'],
});

// Session metrics
export const sessionsActive = new promClient.Gauge({
  name: 'sessions_active',
  help: 'Number of active sessions',
  labelNames: ['type'],
});

export const sessionsCreated = new promClient.Counter({
  name: 'sessions_created_total',
  help: 'Total number of sessions created',
  labelNames: ['type'],
});

export const sessionsEnded = new promClient.Counter({
  name: 'sessions_ended_total',
  help: 'Total number of sessions ended',
  labelNames: ['type', 'reason'], // reason: 'normal', 'disconnect', 'timeout'
});

export const sessionDuration = new promClient.Histogram({
  name: 'session_duration_seconds',
  help: 'Duration of chat sessions',
  labelNames: ['type'],
  buckets: [30, 60, 120, 300, 600, 1800, 3600],
});

// User metrics
export const usersOnline = new promClient.Gauge({
  name: 'users_online',
  help: 'Number of users currently online',
});

export const usersRegistered = new promClient.Counter({
  name: 'users_registered_total',
  help: 'Total number of registered users',
});

export const userLoginsTotal = new promClient.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['status'], // status: 'success', 'failed'
});

// Friend system metrics
export const friendRequestsTotal = new promClient.Counter({
  name: 'friend_requests_total',
  help: 'Total number of friend requests',
  labelNames: ['status'], // status: 'sent', 'accepted', 'rejected'
});

export const friendsTotal = new promClient.Gauge({
  name: 'friends_total',
  help: 'Total number of friendships',
});

// Report metrics
export const reportsTotal = new promClient.Counter({
  name: 'reports_total',
  help: 'Total number of reports submitted',
  labelNames: ['reason'],
});

// Database metrics
export const dbQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation'], // operation: 'select', 'insert', 'update', 'delete'
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const dbConnectionsActive = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

export const dbConnectionsIdle = new promClient.Gauge({
  name: 'database_connections_idle',
  help: 'Number of idle database connections',
});

export const dbConnectionsWaiting = new promClient.Gauge({
  name: 'database_connections_waiting',
  help: 'Number of waiting database connections',
});

// Redis metrics
export const redisCommandDuration = new promClient.Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Duration of Redis commands',
  labelNames: ['command'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const redisConnectionsActive = new promClient.Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
});

// Error metrics
export const errorsTotal = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
});

// Business metrics
export const messagesSent = new promClient.Counter({
  name: 'messages_sent_total',
  help: 'Total number of chat messages sent',
  labelNames: ['type'], // type: 'random', 'friend'
});

export const videoCallsTotal = new promClient.Counter({
  name: 'video_calls_total',
  help: 'Total number of video calls',
  labelNames: ['type'], // type: 'random', 'friend'
});

export const audioCallsTotal = new promClient.Counter({
  name: 'audio_calls_total',
  help: 'Total number of audio calls',
  labelNames: ['type'],
});

// Register all custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(wsConnectionsTotal);
register.registerMetric(wsConnectionsCreated);
register.registerMetric(wsConnectionsClosed);
register.registerMetric(wsMessagesTotal);
register.registerMetric(wsMessageDuration);
register.registerMetric(queueSize);
register.registerMetric(queueWaitTime);
register.registerMetric(queueJoinTotal);
register.registerMetric(queueLeaveTotal);
register.registerMetric(matchesTotal);
register.registerMetric(matchesFailed);
register.registerMetric(sessionsActive);
register.registerMetric(sessionsCreated);
register.registerMetric(sessionsEnded);
register.registerMetric(sessionDuration);
register.registerMetric(usersOnline);
register.registerMetric(usersRegistered);
register.registerMetric(userLoginsTotal);
register.registerMetric(friendRequestsTotal);
register.registerMetric(friendsTotal);
register.registerMetric(reportsTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbConnectionsActive);
register.registerMetric(dbConnectionsIdle);
register.registerMetric(dbConnectionsWaiting);
register.registerMetric(redisCommandDuration);
register.registerMetric(redisConnectionsActive);
register.registerMetric(errorsTotal);
register.registerMetric(messagesSent);
register.registerMetric(videoCallsTotal);
register.registerMetric(audioCallsTotal);

// Metrics utility functions
export class MetricsService {
  // Track HTTP request
  static trackHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    httpRequestTotal.labels(method, route, statusCode.toString()).inc();
    httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration / 1000);
  }

  // Track WebSocket connection
  static trackWsConnection() {
    wsConnectionsTotal.inc();
    wsConnectionsCreated.inc();
  }

  static trackWsDisconnection(reason: string) {
    wsConnectionsTotal.dec();
    wsConnectionsClosed.labels(reason).inc();
  }

  // Track queue operations
  static updateQueueSize(type: string, size: number) {
    queueSize.labels(type).set(size);
  }

  static trackQueueJoin(type: string) {
    queueJoinTotal.labels(type).inc();
  }

  static trackQueueLeave(type: string, reason: string) {
    queueLeaveTotal.labels(type, reason).inc();
  }

  static trackQueueWaitTime(type: string, seconds: number) {
    queueWaitTime.labels(type).observe(seconds);
  }

  // Track sessions
  static trackSessionStart(type: string) {
    sessionsActive.labels(type).inc();
    sessionsCreated.labels(type).inc();
  }

  static trackSessionEnd(type: string, reason: string, durationSeconds: number) {
    sessionsActive.labels(type).dec();
    sessionsEnded.labels(type, reason).inc();
    sessionDuration.labels(type).observe(durationSeconds);
  }

  // Track database pool
  static updateDatabasePool(active: number, idle: number, waiting: number) {
    dbConnectionsActive.set(active);
    dbConnectionsIdle.set(idle);
    dbConnectionsWaiting.set(waiting);
  }

  // Track errors
  static trackError(type: string, code: string) {
    errorsTotal.labels(type, code).inc();
  }

  // Update online users count
  static updateOnlineUsers(count: number) {
    usersOnline.set(count);
  }
}

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path || 'unknown';
    
    MetricsService.trackHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration
    );
  });
  
  next();
};

// Initialize monitoring
export const initializeMonitoring = () => {
  if (ENV.ENABLE_METRICS) {
    logger.info('Prometheus metrics enabled');
    logger.info(`Metrics endpoint: http://localhost:${ENV.PORT}/metrics`);
  }
};

// Export metrics endpoint handler
export const getMetrics = async () => {
  return await register.metrics();
};

export default {
  register,
  MetricsService,
  metricsMiddleware,
  initializeMonitoring,
  getMetrics,
};