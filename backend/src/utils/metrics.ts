// ============================================
// FILE 3: src/utils/metrics.ts
// ============================================
import { Registry, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { logger } from './logger';

class MetricsCollector {
  private registry: Registry;
  private prefix: string = 'random_chat_';

  // Counters
  public httpRequestsTotal: Counter;
  public wsConnectionsTotal: Counter;
  public errorsTotal: Counter;
  public matchesTotal: Counter;

  // Gauges
  public wsConnectionsActive: Gauge;
  public usersOnline: Gauge;
  public queueSize: Gauge;
  public sessionsActive: Gauge;

  // Histograms
  public httpRequestDuration: Histogram;
  public wsMessageDuration: Histogram;
  public dbQueryDuration: Histogram;

  constructor() {
    this.registry = new Registry();
    
    // Initialize metrics
    this.httpRequestsTotal = this.createCounter(
      'http_requests_total',
      'Total HTTP requests',
      ['method', 'route', 'status']
    );

    this.wsConnectionsTotal = this.createCounter(
      'ws_connections_total',
      'Total WebSocket connections',
      ['status']
    );

    this.errorsTotal = this.createCounter(
      'errors_total',
      'Total errors',
      ['type', 'code']
    );

    this.matchesTotal = this.createCounter(
      'matches_total',
      'Total matches made',
      ['type']
    );

    this.wsConnectionsActive = this.createGauge(
      'ws_connections_active',
      'Active WebSocket connections'
    );

    this.usersOnline = this.createGauge(
      'users_online',
      'Users currently online'
    );

    this.queueSize = this.createGauge(
      'queue_size',
      'Queue size by type',
      ['type']
    );

    this.sessionsActive = this.createGauge(
      'sessions_active',
      'Active sessions',
      ['type']
    );

    this.httpRequestDuration = this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration',
      ['method', 'route', 'status'],
      [0.1, 0.3, 0.5, 0.7, 1, 3, 5]
    );

    this.wsMessageDuration = this.createHistogram(
      'ws_message_duration_seconds',
      'WebSocket message processing duration',
      ['event'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    );

    this.dbQueryDuration = this.createHistogram(
      'db_query_duration_seconds',
      'Database query duration',
      ['operation'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    );

    logger.info('Metrics collector initialized');
  }

  private createCounter(name: string, help: string, labelNames?: string[]): Counter {
    const counter = new Counter({
      name: this.prefix + name,
      help,
      labelNames,
      registers: [this.registry],
    });
    return counter;
  }

  private createGauge(name: string, help: string, labelNames?: string[]): Gauge {
    const gauge = new Gauge({
      name: this.prefix + name,
      help,
      labelNames,
      registers: [this.registry],
    });
    return gauge;
  }

  private createHistogram(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[]
  ): Histogram {
    const histogram = new Histogram({
      name: this.prefix + name,
      help,
      labelNames,
      buckets,
      registers: [this.registry],
    });
    return histogram;
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Get metrics as JSON
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();
    return metrics;
  }

  // Reset all metrics
  reset(): void {
    this.registry.resetMetrics();
    logger.info('Metrics reset');
  }

  getRegistry(): Registry {
    return this.registry;
  }
}

export const metricsCollector = new MetricsCollector();
export default metricsCollector;