import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import albums from '../../src/routes/albums';
import type { Env } from '../../src/env';

const createMockEnv = () => ({
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  } as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
});

const createTestApp = (env: Env) => {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/api/*', (c, next) => {
    c.set('auth', { userId: 'test-user' });
    return next();
  });
  app.route('/api/albums', albums);
  return app;
};

describe('Albums Routes - Enterprise Tests', () => {
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

  describe('GET /api/albums - Album Listing', () => {
    test('returns empty array when no albums exist', async () => {
      const res = await app.request('/api/albums', {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('albums');
      expect(data.albums).toEqual([]);
    });

    test('returns albums for authenticated user', async () => {
      const mockAlbums = [
        { id: '1', name: 'Family Vacation', owner_id: 'test-user' },
        { id: '2', name: 'Wedding Photos', owner_id: 'test-user' }
      ];

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockAlbums }),
      });

      const res = await app.request('/api/albums', {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.albums).toEqual(mockAlbums);
    });

    test('handles database errors gracefully', async () => {
      (mockEnv.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const res = await app.request('/api/albums', {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/albums/:id - Single Album', () => {
    test('returns album for valid ID', async () => {
      const mockAlbum = { id: 'album-1', name: 'Test Album', owner_id: 'test-user' };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockAlbum),
      });

      const res = await app.request('/api/albums/album-1', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ album: mockAlbum });
    });

    test('returns 404 for non-existent album', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const res = await app.request('/api/albums/nonexistent', {}, mockEnv);
      expect(res.status).toBe(404);
    });

    test('prevents access to other users albums', async () => {
      // Mock album belongs to different user
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Not found for this user
      });

      const res = await app.request('/api/albums/other-user-album', {}, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/albums - Album Creation', () => {
    test('creates album successfully with valid data', async () => {
      const req = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Album', description: 'Test description' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('message');
    });

    test('validates required name field', async () => {
      const req = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ description: 'Missing name' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });

    test('handles database errors during creation', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Album' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/albums/:id - Album Updates', () => {
    test('updates album successfully', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const req = new Request('http://localhost/api/albums/album-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Album', description: 'Updated description' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('validates required name field', async () => {
      const req = new Request('http://localhost/api/albums/album-1', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Missing name' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });

    test('handles album not found', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: false }),
      });

      const req = new Request('http://localhost/api/albums/album-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Album' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/albums/:id - Album Deletion', () => {
    test('deletes album successfully', async () => {
      const res = await app.request('/api/albums/album-1', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('handles database errors during deletion', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const res = await app.request('/api/albums/album-1', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/albums/:id/photos - Add Photo to Album', () => {
    test('adds photo to album successfully', async () => {
      // Mock album exists and belongs to user
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'album-1' }),
      });

      // Mock photo exists and belongs to user
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'photo-1' }),
      });

      // Mock successful insertion
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const req = new Request('http://localhost/api/albums/album-1/photos', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'photo-1' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('validates photoId requirement', async () => {
      const req = new Request('http://localhost/api/albums/album-1/photos', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });

    test('prevents adding photo to non-existent album', async () => {
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Album not found
      });

      const req = new Request('http://localhost/api/albums/nonexistent/photos', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'photo-1' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(404);
    });

    test('prevents adding non-existent photo to album', async () => {
      // Mock album exists
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'album-1' }),
      });

      // Mock photo doesn't exist for user
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const req = new Request('http://localhost/api/albums/album-1/photos', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'nonexistent' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/albums/:id/photos/:photoId - Remove Photo from Album', () => {
    test('removes photo from album successfully', async () => {
      // Mock album exists and belongs to user
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'album-1' }),
      });

      // Mock successful deletion
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const res = await app.request('/api/albums/album-1/photos/photo-1', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('prevents removing photo from non-existent album', async () => {
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Album not found
      });

      const res = await app.request('/api/albums/nonexistent/photos/photo-1', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('Security and Authorization', () => {
    test('rejects requests without authentication', async () => {
      const unauthApp = new Hono<{ Bindings: Env }>();
      unauthApp.route('/api/albums', albums);

      const res = await unauthApp.request('/api/albums', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('prevents access to other users albums', async () => {
      // Mock album belongs to different user
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Not found for this user
      });

      const res = await app.request('/api/albums/other-user-album', {}, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('handles malformed JSON gracefully', async () => {
      const req = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect([400, 500]).toContain(res.status);
    });

    test('handles database connection failures', async () => {
      (mockEnv.DB.prepare as any).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const res = await app.request('/api/albums', {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });
});
