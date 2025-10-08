import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import share from '../../src/routes/share';
import type { Env } from '../../src/env';
import { zValidator } from '@hono/zod-validator';

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
      first: vi.fn().mockResolvedValue({ type: 'photo', target_id: 'photo-1', expires_at: null, revoked_at: null }),
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
      first: vi.fn().mockResolvedValue({ type: 'album', target_id: 'album-1', expires_at: null, revoked_at: null }),
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

  test('GET /share/:token - returns 404 when revoked', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/share', share);

    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ type: 'photo', target_id: 'photo-1', revoked_at: 'yesterday', expires_at: null }),
    });

    const res = await app.request('/share/token789', {}, mockEnv);
    expect(res.status).toBe(404);
  });

  test('GET /share/:token - returns 404 when expired', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/share', share);

    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ type: 'photo', target_id: 'photo-1', revoked_at: null, expires_at: '2000-01-01T00:00:00.000Z' }),
    });

    const res = await app.request('/share/expired', {}, mockEnv);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/share/:token - revokes share if owner', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/api/*', (c, next) => { c.set('auth', { userId: 'owner-1' }); return next(); });
    app.route('/api/share', share);

    // Lookup share
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'share-1', owner_id: 'owner-1', revoked_at: null }),
    });
    // Update revoke
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    });

    const res = await app.request('/api/share/token-to-revoke', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  test('DELETE /api/share/:token - forbidden when not owner', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/api/*', (c, next) => { c.set('auth', { userId: 'not-owner' }); return next(); });
    app.route('/api/share', share);

    // Lookup share
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'share-1', owner_id: 'owner-1', revoked_at: null }),
    });

    const res = await app.request('/api/share/token-to-revoke', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(403);
  });
});