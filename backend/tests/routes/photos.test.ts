import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import photos from '../../src/routes/photos';
import type { Env } from '../../src/env';

// Mock env for tests
const createMockEnv = () => ({
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
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  } as any,
  PHOTOS_BUCKET: {
    get: vi.fn().mockResolvedValue(null),
  } as any,
  AI_MODEL_WHISPER: '@cf/openai/whisper',
  AI: { run: vi.fn().mockResolvedValue({ text: 'Mock transcription' }) } as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key',
});

const createTestApp = (env: Env) => {
  const app = new Hono<{ Bindings: Env }>();
  // Mock auth middleware for tests
  app.use('/api/*', (c, next) => {
    c.set('auth', { userId: 'test-user' });
    return next();
  });
  app.route('/api/photos', photos);
  return app;
};

describe('Photos Routes - Enterprise Tests', () => {
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

  describe('GET /api/photos - Photo Listing', () => {
    test('returns empty array when no photos exist', async () => {
      const res = await app.request('/api/photos', {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('photos');
      expect(data.photos).toEqual([]);
    });

    test('returns photos with pagination info', async () => {
      const mockPhotos = [
        { id: '1', r2_key: 'photo1.jpg', owner_id: 'test-user' },
        { id: '2', r2_key: 'photo2.jpg', owner_id: 'test-user' }
      ];

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockPhotos }),
      });

      const res = await app.request('/api/photos?page=1&limit=2', {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.photos).toEqual(mockPhotos);
      expect(data.pagination).toBeDefined();
    });

    test('filters photos by search query', async () => {
      const res = await app.request('/api/photos?search=test', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('transcription_text LIKE'));
    });

    test('filters photos by tags', async () => {
      const res = await app.request('/api/photos?tags=family,vacation', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('t.name = ?'));
    });

    test('sorts photos by different criteria', async () => {
      const res = await app.request('/api/photos?sort=oldest', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY p.created_at ASC'));
    });

    test('validates pagination parameters', async () => {
      const res = await app.request('/api/photos?page=invalid&limit=invalid', {}, mockEnv);
      expect(res.status).toBe(200); // Should handle invalid params gracefully
    });
  });

  describe('POST /api/photos/uploads/image - Presigned URL Generation', () => {
    test('generates presigned URL for valid filename', async () => {
      const req = new Request('http://localhost/api/photos/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ filename: 'test.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('uploadUrl');
      expect(data).toHaveProperty('key');
    });

    test('rejects requests without filename', async () => {
      const req = new Request('http://localhost/api/photos/uploads/image', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400); // Should validate required fields
    });

    test('handles R2 credential errors gracefully', async () => {
      // Mock missing credentials
      const envWithoutCredentials = { ...mockEnv };
      delete (envWithoutCredentials as any).CLOUDFLARE_ACCOUNT_ID;

      const req = new Request('http://localhost/api/photos/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ filename: 'test.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, envWithoutCredentials);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/photos - Photo Creation', () => {
    test('creates photo record successfully', async () => {
      const req = new Request('http://localhost/api/photos', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'test-photo.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('message');
    });

    test('validates r2Key requirement', async () => {
      const req = new Request('http://localhost/api/photos', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });

    test('handles database errors gracefully', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/api/photos', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'test.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/photos/:photoId/caption - Caption Updates', () => {
    test('updates photo caption successfully', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const req = new Request('http://localhost/api/photos/photo-id/caption', {
        method: 'PUT',
        body: JSON.stringify({ caption: 'New caption' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('validates caption requirement', async () => {
      const req = new Request('http://localhost/api/photos/photo-id/caption', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });

    test('handles photo not found', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: false }),
      });

      const req = new Request('http://localhost/api/photos/photo-id/caption', {
        method: 'PUT',
        body: JSON.stringify({ caption: 'New caption' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/photos/:photoId - Photo Deletion', () => {
    test('deletes photo and schedules R2 cleanup', async () => {
      // Mock finding the photo
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ r2_key: 'test-key' }),
      });

      // Mock deletion
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const res = await app.request('/api/photos/test-id', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('handles photo not found', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const res = await app.request('/api/photos/nonexistent', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(404);
    });

    test('handles database errors during deletion', async () => {
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ r2_key: 'test-key' }),
      });

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const res = await app.request('/api/photos/test-id', { method: 'DELETE' }, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/photos/:photoId/transcribe - Audio Transcription', () => {
    test('transcribes audio successfully', async () => {
      // Mock photo exists
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'photo-id' }),
      });

      // Mock AI transcription
      (mockEnv.PHOTOS_BUCKET.get as any).mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      const req = new Request('http://localhost/api/photos/photo-id/transcribe', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'audio-key' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty('transcription');
    });

    test('rejects transcription for non-existent photo', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const req = new Request('http://localhost/api/photos/nonexistent/transcribe', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'audio-key' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(404);
    });

    test('handles transcription limit exceeded', async () => {
      // Mock photo exists but limit exceeded
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'photo-id' }),
      });

      // Mock transcription function that throws limit error
      const { transcribeAudioAndUpdatePhoto } = await import('../../src/services/ai');
      vi.spyOn(await import('../../src/services/ai'), 'transcribeAudioAndUpdatePhoto')
        .mockRejectedValue(new Error('Transcription limit exceeded'));

      const req = new Request('http://localhost/api/photos/photo-id/transcribe', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'audio-key' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(402); // Payment required for limit exceeded
    });
  });

  describe('POST /api/photos/:photoId/tags - Tag Management', () => {
    test('adds tags to photo successfully', async () => {
      // Mock photo exists
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'photo-id' }),
      });

      // Mock successful tag operations
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const req = new Request('http://localhost/api/photos/photo-id/tags', {
        method: 'POST',
        body: JSON.stringify({ tags: ['family', 'vacation'] }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    test('validates tags array requirement', async () => {
      const req = new Request('http://localhost/api/photos/photo-id/tags', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/photos/:photoId/tags - Tag Removal', () => {
    test('removes tags from photo successfully', async () => {
      // Mock photo exists
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'photo-id' }),
      });

      // Mock tag removal operations
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }, { id: 2 }] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const req = new Request('http://localhost/api/photos/photo-id/tags', {
        method: 'DELETE',
        body: JSON.stringify({ tags: ['family'] }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await app.request(req, {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });
  });

  describe('Security and Authorization', () => {
    test('rejects requests without authentication', async () => {
      const unauthApp = new Hono<{ Bindings: Env }>();
      unauthApp.route('/api/photos', photos);

      const res = await unauthApp.request('/api/photos', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('prevents access to other users photos', async () => {
      // Mock photo belongs to different user
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Photo not found for this user
      });

      const res = await app.request('/api/photos/other-user-photo', {}, mockEnv);
      expect(res.status).toBe(404); // Should appear as not found for security
    });
  });

  describe('Error Handling', () => {
    test('handles malformed JSON gracefully', async () => {
      const req = new Request('http://localhost/api/photos', {
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

      const res = await app.request('/api/photos', {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });
});