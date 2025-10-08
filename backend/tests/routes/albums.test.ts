import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import albums from '../../src/routes/albums';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => await fn({
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  } as any,
  PHOTOS_BUCKET: {} as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

const app = new Hono<{ Bindings: Env }>();
// Mock auth context
app.use('/api/*', (c, next) => {
  c.set('auth', { userId: 'user-1' });
  return next();
});
app.route('/api/albums', albums);

describe('Albums Routes', () => {
  test('GET /api/albums - lists albums', async () => {
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: 'a1', name: 'Album 1', description: '' }] }),
    });

    const res = await app.request('/api/albums', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.albums)).toBe(true);
  });

  test('POST /api/albums - creates album', async () => {
    const req = new Request('http://localhost/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Album', description: 'desc' }),
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('message', 'Album created successfully');
  });

  test('POST /api/albums/:id/photos - add photo to album', async () => {
    // album exists
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'album-1' }),
    });
    // photo exists
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'photo-1' }),
    });
    // insert mapping
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    });

    const req = new Request('http://localhost/api/albums/album-1/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: 'photo-1' }),
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });
});