// ============================================
// FILE 1: src/database/connection.ts
// ============================================
import { Pool, PoolClient, QueryResult } from 'pg';
import { ENV } from '../config/environment';
import { logger } from '../utils/logger';

class DatabaseConnection {
  private pool: Pool | null = null;
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor() {
    this.createPool();
  }

  private createPool(): void {
    this.pool = new Pool({
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      database: ENV.DB_NAME,
      user: ENV.DB_USER,
      password: ENV.DB_PASSWORD,
      
      // Connection pool settings
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      
      // SSL for production
      ssl: ENV.IS_PRODUCTION ? {
        rejectUnauthorized: false
      } : false,
      
      // Performance
      statement_timeout: 10000,
      query_timeout: 10000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.pool) return;

    this.pool.on('connect', (client) => {
      logger.debug('New database client connected');
      client.query('SET timezone = "UTC"');
    });

    this.pool.on('acquire', () => {
      logger.debug('Client acquired from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Unexpected database error on idle client', err);
      this.handleConnectionError(err);
    });

    this.pool.on('remove', () => {
      logger.debug('Client removed from pool');
    });
  }

  private async handleConnectionError(error: Error): Promise<void> {
    logger.error('Database connection error:', error);
    
    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      logger.info(`Attempting to reconnect... (${this.retryCount}/${this.MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      await this.reconnect();
    } else {
      logger.error('Max retry attempts reached. Database connection failed.');
      process.exit(1);
    }
  }

  private async reconnect(): Promise<void> {
    try {
      await this.close();
      this.createPool();
      await this.testConnection();
      this.retryCount = 0;
      logger.info('Database reconnected successfully');
    } catch (error) {
      logger.error('Reconnection failed:', error);
      await this.handleConnectionError(error as Error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
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
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    
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
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool;
  }

  getPoolStats() {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database pool closed');
    }
  }

  async runMigrations(): Promise<void> {
    const migrations = [
      '001_create_users.sql',
      '002_create_friendships.sql',
      '003_create_sessions.sql',
      '004_create_reports.sql',
      '005_add_indexes.sql',
    ];

    logger.info('Running database migrations...');

    for (const migration of migrations) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const migrationPath = path.join(__dirname, 'migrations', migration);
        const sql = await fs.readFile(migrationPath, 'utf-8');
        
        await this.query(sql);
        logger.info(`✓ Migration ${migration} completed`);
      } catch (error) {
        logger.error(`✗ Migration ${migration} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  }
}

export const dbConnection = new DatabaseConnection();
export default dbConnection;
