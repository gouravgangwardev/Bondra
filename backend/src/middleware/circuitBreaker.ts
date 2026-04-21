// ============================================
// FILE 6: src/middleware/circuitBreaker.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../config/constants';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitorInterval: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  
  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const timeSinceLastFailure = now - this.lastFailureTime;
      
      if (timeSinceLastFailure >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker: OPEN -> HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        logger.info('Circuit breaker: HALF_OPEN -> CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      if (this.state !== CircuitState.OPEN) {
        this.state = CircuitState.OPEN;
        logger.warn(`Circuit breaker: ${this.state} -> OPEN (failures: ${this.failures})`);
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info('Circuit breaker reset');
  }
}

// Create circuit breakers for different services
const breakers = {
  database: new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitorInterval: 30000,
  }),
  redis: new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    monitorInterval: 15000,
  }),
  external: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 120000, // 2 minutes
    monitorInterval: 60000,
  }),
};

// Circuit breaker middleware
export const circuitBreakerMiddleware = (serviceName: keyof typeof breakers) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const breaker = breakers[serviceName];

    if (breaker.getState() === CircuitState.OPEN) {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: `${serviceName} service is temporarily unavailable`,
      });
      return;
    }

    next();
  };
};

// Execute function with circuit breaker
export const withCircuitBreaker = async <T>(
  serviceName: keyof typeof breakers,
  fn: () => Promise<T>
): Promise<T> => {
  const breaker = breakers[serviceName];
  return breaker.execute(fn);
};

// Get circuit breaker stats
export const getCircuitBreakerStats = () => {
  return Object.entries(breakers).map(([name, breaker]) => ({
    service: name,
    ...breaker.getStats(),
  }));
};

// Reset all circuit breakers
export const resetAllCircuitBreakers = (): void => {
  Object.values(breakers).forEach(breaker => breaker.reset());
  logger.info('All circuit breakers reset');
};

export default breakers;