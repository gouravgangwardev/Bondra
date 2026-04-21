// src/services/matching/loadBalancer.ts
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';
import os from 'os';

export interface IServerInstance {
  instanceId: string;
  host: string;
  port: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  lastHeartbeat: number;
  isHealthy: boolean;
}

export interface ILoadMetrics {
  cpu: number;
  memory: number;
  connections: number;
  timestamp: number;
}

export class LoadBalancer {
  private instanceId: string;
  private readonly INSTANCE_TTL = 30; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly REDIS_KEY_PREFIX = 'loadbalancer:instance:';
  private readonly REDIS_METRICS_PREFIX = 'loadbalancer:metrics:';

  constructor() {
    this.instanceId = this.generateInstanceId();
  }

  // Generate unique instance ID
  private generateInstanceId(): string {
    const hostname = os.hostname();
    const pid = process.pid;
    const timestamp = Date.now();
    return `${hostname}_${pid}_${timestamp}`;
  }

  // Start load balancer (register instance and start heartbeat)
  async start(port: number): Promise<void> {
    try {
      await this.registerInstance(port);
      this.startHeartbeat();
      logger.info(`Load balancer started for instance: ${this.instanceId}`);
    } catch (error) {
      logger.error('Error starting load balancer:', error);
      throw error;
    }
  }

  // Stop load balancer (cleanup and stop heartbeat)
  async stop(): Promise<void> {
    try {
      this.stopHeartbeat();
      await this.deregisterInstance();
      logger.info(`Load balancer stopped for instance: ${this.instanceId}`);
    } catch (error) {
      logger.error('Error stopping load balancer:', error);
    }
  }

  // Register this instance
  private async registerInstance(port: number): Promise<void> {
    try {
      const instance: IServerInstance = {
        instanceId: this.instanceId,
        host: os.hostname(),
        port,
        activeConnections: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHeartbeat: Date.now(),
        isHealthy: true,
      };

      await redisClient.setex(
        `${this.REDIS_KEY_PREFIX}${this.instanceId}`,
        this.INSTANCE_TTL,
        JSON.stringify(instance)
      );

      logger.info(`Instance registered: ${this.instanceId} on port ${port}`);
    } catch (error) {
      logger.error('Error registering instance:', error);
      throw error;
    }
  }

  // Deregister this instance
  private async deregisterInstance(): Promise<void> {
    try {
      await redisClient.del(`${this.REDIS_KEY_PREFIX}${this.instanceId}`);
      await redisClient.del(`${this.REDIS_METRICS_PREFIX}${this.instanceId}`);
      logger.info(`Instance deregistered: ${this.instanceId}`);
    } catch (error) {
      logger.error('Error deregistering instance:', error);
    }
  }

  // Start heartbeat to keep instance alive
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        logger.error('Error sending heartbeat:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // Send heartbeat with current metrics
  private async sendHeartbeat(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      
      // Update instance with current metrics
      const instanceKey = `${this.REDIS_KEY_PREFIX}${this.instanceId}`;
      const instanceData = await redisClient.get(instanceKey);

      if (instanceData) {
        const instance: IServerInstance = JSON.parse(instanceData);
        instance.cpuUsage = metrics.cpu;
        instance.memoryUsage = metrics.memory;
        instance.lastHeartbeat = Date.now();

        await redisClient.setex(
          instanceKey,
          this.INSTANCE_TTL,
          JSON.stringify(instance)
        );

        // Store metrics history
        await this.storeMetrics(metrics);
      }
    } catch (error) {
      logger.error('Error in heartbeat:', error);
    }
  }

  // Collect current metrics
  private async collectMetrics(): Promise<ILoadMetrics> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - (100 * totalIdle / totalTick);
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    return {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: Math.round(memoryUsage * 100) / 100,
      connections: 0, // Will be updated separately
      timestamp: Date.now(),
    };
  }

  // Store metrics in Redis (for monitoring)
  private async storeMetrics(metrics: ILoadMetrics): Promise<void> {
    try {
      const metricsKey = `${this.REDIS_METRICS_PREFIX}${this.instanceId}`;
      
      // Store last 100 metric entries (using sorted set)
      await redisClient.zadd(
        metricsKey,
        metrics.timestamp,
        JSON.stringify(metrics)
      );

      // Keep only last 100 entries
      await redisClient.zremrangebyrank(metricsKey, 0, -101);
      
      // Set expiry
      await redisClient.expire(metricsKey, 3600); // 1 hour
    } catch (error) {
      logger.error('Error storing metrics:', error);
    }
  }

  // Update active connections count
  async updateConnectionCount(count: number): Promise<void> {
    try {
      const instanceKey = `${this.REDIS_KEY_PREFIX}${this.instanceId}`;
      const instanceData = await redisClient.get(instanceKey);

      if (instanceData) {
        const instance: IServerInstance = JSON.parse(instanceData);
        instance.activeConnections = count;

        await redisClient.setex(
          instanceKey,
          this.INSTANCE_TTL,
          JSON.stringify(instance)
        );
      }
    } catch (error) {
      logger.error('Error updating connection count:', error);
    }
  }

  // Get all healthy instances
  static async getHealthyInstances(): Promise<IServerInstance[]> {
    try {
      const pattern = 'loadbalancer:instance:*';
      let cursor = '0';
      const instances: IServerInstance[] = [];

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const data = await redisClient.get(key);
          if (data) {
            const instance: IServerInstance = JSON.parse(data);
            
            // Check if instance is still healthy (heartbeat within last 30 seconds)
            const timeSinceHeartbeat = Date.now() - instance.lastHeartbeat;
            if (timeSinceHeartbeat < 30000 && instance.isHealthy) {
              instances.push(instance);
            }
          }
        }
      } while (cursor !== '0');

      return instances;
    } catch (error) {
      logger.error('Error getting healthy instances:', error);
      return [];
    }
  }

  // Get least loaded instance (for routing decisions)
  static async getLeastLoadedInstance(): Promise<IServerInstance | null> {
    try {
      const instances = await this.getHealthyInstances();

      if (instances.length === 0) {
        return null;
      }

      // Calculate load score (weighted: 40% CPU, 30% Memory, 30% Connections)
      const instancesWithScore = instances.map(instance => ({
        ...instance,
        loadScore: 
          (instance.cpuUsage * 0.4) +
          (instance.memoryUsage * 0.3) +
          ((instance.activeConnections / 100) * 0.3)
      }));

      // Sort by load score (ascending)
      instancesWithScore.sort((a, b) => a.loadScore - b.loadScore);

      return instancesWithScore[0];
    } catch (error) {
      logger.error('Error getting least loaded instance:', error);
      return null;
    }
  }

  // Get cluster statistics
  static async getClusterStats(): Promise<any> {
    try {
      const instances = await this.getHealthyInstances();

      if (instances.length === 0) {
        return {
          totalInstances: 0,
          totalConnections: 0,
          avgCpuUsage: 0,
          avgMemoryUsage: 0,
        };
      }

      const totalConnections = instances.reduce(
        (sum, inst) => sum + inst.activeConnections,
        0
      );
      const avgCpuUsage = instances.reduce(
        (sum, inst) => sum + inst.cpuUsage,
        0
      ) / instances.length;
      const avgMemoryUsage = instances.reduce(
        (sum, inst) => sum + inst.memoryUsage,
        0
      ) / instances.length;

      return {
        totalInstances: instances.length,
        totalConnections,
        avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
        avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
        instances: instances.map(inst => ({
          instanceId: inst.instanceId,
          host: inst.host,
          port: inst.port,
          connections: inst.activeConnections,
          cpu: inst.cpuUsage,
          memory: inst.memoryUsage,
        })),
      };
    } catch (error) {
      logger.error('Error getting cluster stats:', error);
      return null;
    }
  }

  // Get instance metrics history
  static async getInstanceMetrics(
    instanceId: string,
    limit: number = 50
  ): Promise<ILoadMetrics[]> {
    try {
      const metricsKey = `loadbalancer:metrics:${instanceId}`;
      
      // Get last N metrics (newest first)
      const metricsData = await redisClient.zrevrange(metricsKey, 0, limit - 1);

      return metricsData.map(data => JSON.parse(data));
    } catch (error) {
      logger.error('Error getting instance metrics:', error);
      return [];
    }
  }

  // Clean up dead instances
  static async cleanupDeadInstances(): Promise<number> {
    try {
      const pattern = 'loadbalancer:instance:*';
      let cursor = '0';
      let cleaned = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const data = await redisClient.get(key);
          if (data) {
            const instance: IServerInstance = JSON.parse(data);
            
            // Remove if heartbeat is older than 60 seconds
            const timeSinceHeartbeat = Date.now() - instance.lastHeartbeat;
            if (timeSinceHeartbeat > 60000) {
              await redisClient.del(key);
              await redisClient.del(`loadbalancer:metrics:${instance.instanceId}`);
              cleaned++;
              logger.info(`Cleaned up dead instance: ${instance.instanceId}`);
            }
          }
        }
      } while (cursor !== '0');

      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up dead instances:', error);
      return 0;
    }
  }

  // Check if this instance should accept new connections
  async shouldAcceptConnection(): Promise<boolean> {
    try {
      const metrics = await this.collectMetrics();
      
      // Don't accept if CPU > 90% or Memory > 85%
      if (metrics.cpu > 90 || metrics.memory > 85) {
        logger.warn('Instance overloaded, rejecting new connections');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking if should accept connection:', error);
      return true; // Default to accepting
    }
  }

  // Get current instance ID
  getInstanceId(): string {
    return this.instanceId;
  }

  // Get instance info
  async getInstanceInfo(): Promise<IServerInstance | null> {
    try {
      const data = await redisClient.get(`${this.REDIS_KEY_PREFIX}${this.instanceId}`);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error('Error getting instance info:', error);
      return null;
    }
  }

  // Mark instance as unhealthy
  async markUnhealthy(): Promise<void> {
    try {
      const instanceKey = `${this.REDIS_KEY_PREFIX}${this.instanceId}`;
      const instanceData = await redisClient.get(instanceKey);

      if (instanceData) {
        const instance: IServerInstance = JSON.parse(instanceData);
        instance.isHealthy = false;

        await redisClient.setex(
          instanceKey,
          this.INSTANCE_TTL,
          JSON.stringify(instance)
        );

        logger.warn(`Instance marked as unhealthy: ${this.instanceId}`);
      }
    } catch (error) {
      logger.error('Error marking instance unhealthy:', error);
    }
  }

  // Mark instance as healthy
  async markHealthy(): Promise<void> {
    try {
      const instanceKey = `${this.REDIS_KEY_PREFIX}${this.instanceId}`;
      const instanceData = await redisClient.get(instanceKey);

      if (instanceData) {
        const instance: IServerInstance = JSON.parse(instanceData);
        instance.isHealthy = true;

        await redisClient.setex(
          instanceKey,
          this.INSTANCE_TTL,
          JSON.stringify(instance)
        );

        logger.info(`Instance marked as healthy: ${this.instanceId}`);
      }
    } catch (error) {
      logger.error('Error marking instance healthy:', error);
    }
  }
}

export default LoadBalancer;
