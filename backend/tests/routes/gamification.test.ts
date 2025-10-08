import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import gamification from '../../src/routes/gamification';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };
      return await fn(tx as any);
    }),
  } as any,
  PHOTOS_BUCKET: {} as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', (c, next) => {
  c.set('auth', { userId: 'test-user' });
  return next();
});
app.route('/api/gamification', gamification);

describe('Gamification Routes', () => {
  test('GET /api/gamification - returns streak and achievements', async () => {
    // streak
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ current_streak: 3 }),
    });
    // achievements
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ name: 'FIRST_UPLOAD', description: 'desc' }] }),
    });

    const res = await app.request('/api/gamification', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('streak', 3);
    expect(Array.isArray(json.achievements)).toBe(true);
  });

  test('POST /api/gamification/actions/:type - updates streak and achievements', async () => {
    const req = new Request('http://localhost/api/gamification/actions/digitize', {
      method: 'POST',
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });
});