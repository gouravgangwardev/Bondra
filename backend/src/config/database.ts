// src/config/database.ts
import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';
import { ENV } from './environment';

// PostgreSQL pool configuration for high concurrency
const poolConfig: PoolConfig = {
  host: ENV.DB_HOST,
  port: ENV.DB_PORT,
  database: ENV.DB_NAME,
  user: ENV.DB_USER,
  password: ENV.DB_PASSWORD,
  
  // Connection pool settings for 500+ concurrent users
  max: 20,                          // Maximum connections per instance
  min: 5,                           // Minimum idle connections
  idleTimeoutMillis: 30000,         // Close idle connections after 30s
  connectionTimeoutMillis: 5000,    // Fail fast if can't connect in 5s
  
  // Connection lifecycle
  maxUses: 7500,                    // Recycle connection after 7500 queries
  allowExitOnIdle: false,           // Keep pool alive
  
  // SSL for production
  ssl: ENV.NODE_ENV === 'production' ? {
    rejectUnauthorized: false       // Set to true with proper certs
  } : false,
  
  // Performance tuning
  statement_timeout: 10000,          // 10s statement timeout
  query_timeout: 10000,              // 10s query timeout
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Pool event handlers
pool.on('connect', (client) => {
  logger.debug('New database client connected');
  
  // Set timezone for all connections
  client.query('SET timezone = "UTC"');
});

pool.on('acquire', () => {
  logger.debug('Client acquired from pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected database error on idle client', err);
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

// Get pool statistics
export const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
};

// Query helper with error handling
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Query executed', {
      text,
      duration,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    logger.error('Database query error:', { text, error });
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;