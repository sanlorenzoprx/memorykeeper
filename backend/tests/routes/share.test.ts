import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import share from '../../src/routes/share';
import type { Env } from '../../src/env';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn(),
    transaction: vi.fn(),
  } as any,
  PHOTOS_BUCKET: {} as any,
  AI: {} as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

describe('Share Routes', () => {
  test('GET /share/:token - returns shared photo', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/share', share);

    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ type: 'photo', target_id: 'photo-1' }),
    });
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'photo-1', r2_key: 'k', alt_text: null, transcription_text: null, created_at: 'now' }),
    });

    const res = await app.request('/share/token123', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe('photo');
    expect(json.data).toHaveProperty('id', 'photo-1');
  });

  test('GET /share/:token - returns shared album with photos', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/share', share);

    // first: share lookup
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ type: 'album', target_id: 'album-1' }),
    });
    // album lookup
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'album-1', name: 'My Album', description: 'desc', created_at: 'now' }),
    });
    // photos lookup
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: 'photo-1', r2_key: 'k', alt_text: null, transcription_text: null, created_at: 'now' }] }),
    });

    const res = await app.request('/share/token456', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe('album');
    expect(json.data).toHaveProperty('album');
    expect(json.data).toHaveProperty('photos');
    expect(Array.isArray(json.data.photos)).toBe(true);
  });
});