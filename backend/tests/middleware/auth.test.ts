import { describe, test, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth';
import photos from '../../src/routes/photos';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {} as any,
  PHOTOS_BUCKET: {} as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

describe('Auth Middleware', () => {
  test('returns 401 when Authorization header missing', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/api/*', authMiddleware);
    app.route('/api/photos', photos);

    const res = await app.request('/api/photos', {}, mockEnv);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });
});