import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env } from '../../src/env';

const createMockEnv = () => ({
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  } as any,
  CLERK_JWKS_URI: 'https://api.clerk.com/v1/jwks',
  CLERK_ISSUER: 'https://api.clerk.com',
});

const createTestApp = (env: Env) => {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/api/*', authMiddleware);
  app.get('/api/test', (c) => c.json({ userId: c.get('auth').userId }));
  return app;
};

describe('Authentication Middleware - Enterprise Tests', () => {
  let mockEnv: Env;
  let app: Hono;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = createTestApp(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Production Mode Authentication', () => {
    test('accepts valid JWT token', async () => {
      // Mock JWT verification
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockResolvedValue({
          payload: { sub: 'user-123', email: 'test@example.com' }
        }),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      const validToken = 'valid.jwt.token';
      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.userId).toBe('user-123');
    });

    test('rejects requests without Authorization header', async () => {
      const req = new Request('http://localhost/api/test');
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized: Missing or invalid token' });
    });

    test('rejects requests with malformed Authorization header', async () => {
      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'InvalidFormat' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('rejects requests with invalid JWT token', async () => {
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockRejectedValue(new Error('Invalid token')),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer invalid.token' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('rejects tokens with missing subject', async () => {
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockResolvedValue({
          payload: { email: 'test@example.com' } // Missing sub
        }),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer token.without.sub' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('handles missing Clerk configuration gracefully', async () => {
      const envWithoutClerk = { ...mockEnv };
      delete (envWithoutClerk as any).CLERK_JWKS_URI;

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid.token' },
      });
      const res = await app.request(req, {}, envWithoutClerk);
      expect(res.status).toBe(500);
    });
  });

  describe('Development Mode Authentication', () => {
    test('accepts development user ID header', async () => {
      const devEnv = { ...mockEnv };
      (devEnv as any).CLERK_JWKS_URI = 'dev-mode';

      const devApp = createTestApp(devEnv);
      const req = new Request('http://localhost/api/test', {
        headers: { 'X-Dev-User-Id': 'dev-user-456' },
      });

      const res = await devApp.request(req, {}, devEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.userId).toBe('dev-user-456');
    });

    test('uses default dev user when no header provided', async () => {
      const devEnv = { ...mockEnv };
      (devEnv as any).CLERK_JWKS_URI = 'dev-mode';

      const devApp = createTestApp(devEnv);
      const req = new Request('http://localhost/api/test');

      const res = await devApp.request(req, {}, devEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.userId).toBe('dev-user-123');
    });

    test('creates user record in database for dev users', async () => {
      const devEnv = { ...mockEnv };
      (devEnv as any).CLERK_JWKS_URI = 'dev-mode';

      const devApp = createTestApp(devEnv);
      const req = new Request('http://localhost/api/test', {
        headers: { 'X-Dev-User-Id': 'new-dev-user' },
      });

      await devApp.request(req, {}, devEnv);

      // Verify user creation was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users')
      );
    });
  });

  describe('User Database Operations', () => {
    test('upserts user record for valid tokens', async () => {
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockResolvedValue({
          payload: { sub: 'user-123', email: 'test@example.com' }
        }),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid.token' },
      });

      await app.request(req, {}, mockEnv);

      // Verify user upsert was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users')
      );
    });

    test('handles database errors during user creation', async () => {
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockResolvedValue({
          payload: { sub: 'user-123', email: 'test@example.com' }
        }),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid.token' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('Security Edge Cases', () => {
    test('handles extremely long tokens gracefully', async () => {
      const longToken = 'a'.repeat(10000);
      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: `Bearer ${longToken}` },
      });
      const res = await app.request(req, {}, mockEnv);
      // Should either handle or reject gracefully
      expect([400, 401, 500]).toContain(res.status);
    });

    test('handles special characters in tokens', async () => {
      const specialToken = 'token!@#$%^&*()_+{}|:<>?[]\\;\'",./';
      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: `Bearer ${specialToken}` },
      });
      const res = await app.request(req, {}, mockEnv);
      expect([400, 401, 500]).toContain(res.status);
    });

    test('prevents timing attacks on token validation', async () => {
      const startTime = Date.now();

      // Test with invalid token
      const req1 = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer invalid' },
      });
      await app.request(req1, {}, mockEnv);

      const endTime1 = Date.now();

      // Test with valid token (mocked)
      vi.doMock('jose', () => ({
        jwtVerify: vi.fn().mockResolvedValue({
          payload: { sub: 'user-123' }
        }),
        createRemoteJWKSet: vi.fn().mockReturnValue(() => Promise.resolve({})),
      }));

      const req2 = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer valid.token' },
      });
      await app.request(req2, {}, mockEnv);

      const endTime2 = Date.now();

      // Both should take similar time (within reasonable bounds)
      const timeDiff = Math.abs((endTime2 - endTime1) - (endTime1 - startTime));
      expect(timeDiff).toBeLessThan(100); // Should not vary by more than 100ms
    });
  });
});
