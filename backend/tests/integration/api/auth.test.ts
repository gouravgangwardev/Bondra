// ============================================
// FILE 3: tests/integration/api/auth.test.ts
// ============================================
import request from 'supertest';
import app from '../../../src/app';
import { dbConnection } from '../../../src/database/connection';

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    await dbConnection.testConnection();
  });

  afterAll(async () => {
    await dbConnection.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `testuser_${Date.now()}`,
          email: `test${Date.now()}@example.com`,
          password: 'Password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user', async () => {
      // First register
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `logintest_${Date.now()}`,
          email: `logintest${Date.now()}@example.com`,
          password: 'Password123',
        });

      // Then login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: `logintest_${Date.now()}`,
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrong',
        });

      expect(response.status).toBe(401);
    });
  });
});
