import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import photos from '../../src/routes/photos';
import type { Env } from '../../src/env';

const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', (c, next) => {
  c.set('auth', { userId: 'u1' });
  return next();
});
app.route('/api/photos', photos);

describe('Photos pagination validation', () => {
  test('clamps limit and offset to valid ranges', async () => {
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any,
    } as any;

    const res = await app.request('/api/photos?limit=1000&offset=-5', {}, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photos: [] });

    // ensure bind was called with clamped values: limit <= 100, offset >= 0
    const calls = (mockEnv.DB.prepare as any).mock.calls;
    const bindCalls = calls.map((c: any, idx: number) => (mockEnv.DB.prepare as any).mock.results[idx].value.bind.mock.calls);
    const lastBindArgs = bindCalls[bindCalls.length - 1][0];
    // args structure: [userId, limit, offset] or [userId, albumId, limit, offset]
    const limit = lastBindArgs[lastBindArgs.length - 2];
    const offset = lastBindArgs[lastBindArgs.length - 1];
    expect(limit).toBeLessThanOrEqual(100);
    expect(offset).toBeGreaterThanOrEqual(0);
  });
});