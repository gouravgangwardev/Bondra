// tests/setup/globalSetup.ts
// Starts a real Redis instance (or uses a mock) before all tests.
import { execSync } from 'child_process';

export default async function globalSetup(): Promise<void> {
  // Use test Redis DB 15 — set env so all imports pick it up
  process.env.REDIS_HOST     = process.env.REDIS_HOST     || 'localhost';
  process.env.REDIS_PORT     = process.env.REDIS_PORT     || '6379';
  process.env.REDIS_TEST_DB  = '15';

  process.env.JWT_SECRET          = 'test-secret-key-that-is-32-chars-long!!';
  process.env.JWT_REFRESH_SECRET  = 'test-refresh-secret-32-chars-long!!!!!';
  process.env.JWT_EXPIRES_IN      = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.NODE_ENV            = 'test';
  process.env.DB_HOST             = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT             = process.env.DB_PORT || '5432';
  process.env.DB_NAME             = process.env.DB_NAME || 'random_chat_test';
  process.env.DB_USER             = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD         = process.env.DB_PASSWORD || 'postgres';
  process.env.CORS_ORIGIN         = 'http://localhost:3000';
  process.env.LOG_LEVEL           = 'error'; // silence logs in tests
}
