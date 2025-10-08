import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import audio from '../../src/routes/audio';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn(),
  } as any,
  PHOTOS_BUCKET: {
    createPresignedUrl: vi.fn().mockResolvedValue('mock-url'),
  } as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', (c, next) => { c.set('auth', { userId: 'user-1' }); return next(); });
app.route('/api/audio', audio);

describe('Audio Routes', () => {
  test('POST /api/audio/uploads - gets presigned URL', async () => {
    const req = new Request('http://localhost/api/audio/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'voice.webm' }),
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('uploadUrl', 'mock-url');
  });

  test('POST /api/audio/uploads - rejects invalid extension', async () => {
    const req = new Request('http://localhost/api/audio/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'music.exe' }),
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(400);
  });

  test('POST /api/audio/uploads - rate limited when count >= limit', async () => {
    // Mock rate limiter hit: SELECT returns a row with count at limit (10)
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ count: 10 }),
    });

    const req = new Request('http://localhost/api/audio/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'voice.webm' }),
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'Too Many Requests');
  });
});