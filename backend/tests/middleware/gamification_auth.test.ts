import { describe, test, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth';
import gamification from '../../src/routes/gamification';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {} as any,
  PHOTOS_BUCKET: {} as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

describe('Auth Negative - Gamification', () => {
  test('returns 401 when Authorization missing on /api/gamification', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/api/*', authMiddleware);
    app.route('/api/gamification', gamification);

    const res = await app.request('/api/gamification', {}, mockEnv);
    expect(res.status).toBe(401);
  });
});