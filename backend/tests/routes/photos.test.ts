import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import photos from '../../src/routes/photos';
import type { Env } from '../../src/env';

// Mock env for tests
const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => await fn(mockEnv.DB)),
  } as any,
  PHOTOS_BUCKET: {
    createPresignedUrl: vi.fn().mockResolvedValue('mock-url'),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  } as any,
  AI_MODEL_WHISPER: '@cf/openai/whisper',
  AI: { run: vi.fn() } as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

const app = new Hono<{ Bindings: Env }>();
// Mock auth middleware for tests
app.use('/api/*', (c, next) => {
    c.set('auth', { userId: 'test-user' });
    return next();
});
app.route('/api/photos', photos);

describe('Photos Routes', () => {
  test('GET /api/photos - Lists photos', async () => {
    const res = await app.request('/api/photos', {}, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photos: [] });
  });

  test('POST /api/photos/uploads/image - Gets presigned URL', async () => {
    const req = new Request('http://localhost/api/photos/uploads/image', {
      method: 'POST',
      body: JSON.stringify({ filename: 'test.jpg' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await app.request(req, {}, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('uploadUrl', 'mock-url');
  });

  test('DELETE /api/photos/:photoId - Deletes photo and schedules R2 job', async () => {
    // Mock finding the photo to delete
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ r2_key: 'mock-key' }),
    });
    // Mock the delete statement
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
    });
    // Mock the job creation statement
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
    });

    const res = await app.request('/api/photos/mock-id', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});