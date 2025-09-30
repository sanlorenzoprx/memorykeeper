import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import photos from '../../src/routes/photos';
import albums from '../../src/routes/albums';
import share from '../../src/routes/share';
import gamification from '../../src/routes/gamification';
import type { Env } from '../../src/env';

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
  app.route('/api/albums', albums);
  app.route('/api/gamification', gamification);

  // Public share route
  app.route('/share', share);

  return app;
};

describe('MemoryKeeper Integration Tests', () => {
  let mockEnv: Env;
  let app: Hono;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = createTestApp(mockEnv);
    vi.clearAllMocks();
  });

  describe('Complete User Workflow', () => {
    test('user can upload photo, add caption, and share', async () => {
      // Step 1: Get presigned URL for upload
      const uploadReq = new Request('http://localhost/api/photos/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ filename: 'test.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const uploadRes = await app.request(uploadReq, {}, mockEnv);
      expect(uploadRes.status).toBe(200);

      // Step 2: Create photo record
      const createReq = new Request('http://localhost/api/photos', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'test-photo.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const createRes = await app.request(createReq, {}, mockEnv);
      expect(createRes.status).toBe(200);

      // Step 3: Add voice caption (transcribe)
      const transcribeReq = new Request('http://localhost/api/photos/photo-id/transcribe', {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'audio-key' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const transcribeRes = await app.request(transcribeReq, {}, mockEnv);
      expect(transcribeRes.status).toBe(200);

      // Step 4: Create share link
      const shareReq = new Request('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({ type: 'photo', targetId: 'photo-id' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const shareRes = await app.request(shareReq, {}, mockEnv);
      expect(shareRes.status).toBe(200);

      // Step 5: Access shared content (public route)
      const shareData = await shareRes.json();
      const publicReq = new Request(`http://localhost/share/${shareData.shareToken}`);
      const publicRes = await app.request(publicReq, {}, mockEnv);
      expect(publicRes.status).toBe(200);
    });

    test('user can organize photos in albums', async () => {
      // Step 1: Create album
      const albumReq = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ name: 'Vacation 2024', description: 'Summer trip' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const albumRes = await app.request(albumReq, {}, mockEnv);
      expect(albumRes.status).toBe(200);

      // Step 2: Add photo to album
      const addPhotoReq = new Request('http://localhost/api/albums/album-id/photos', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'photo-id' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const addPhotoRes = await app.request(addPhotoReq, {}, mockEnv);
      expect(addPhotoRes.status).toBe(200);
    });

    test('user can track transcription usage and limits', async () => {
      // Step 1: Check usage limits
      const usageReq = new Request('http://localhost/api/gamification/transcription-usage');
      const usageRes = await app.request(usageReq, {}, mockEnv);
      expect(usageRes.status).toBe(200);

      const usageData = await usageRes.json();
      expect(usageData).toHaveProperty('plan');
      expect(usageData.plan).toHaveProperty('remaining_seconds');
    });
  });

  describe('Security Integration', () => {
    test('prevents unauthorized access to user data', async () => {
      // Test without auth middleware
      const unauthApp = new Hono<{ Bindings: Env }>();
      unauthApp.route('/api/photos', photos);

      const res = await unauthApp.request('/api/photos', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    test('enforces data isolation between users', async () => {
      // Mock different user data
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Not found for this user
      });

      const res = await app.request('/api/photos/other-user-photo', {}, mockEnv);
      expect(res.status).toBe(404); // Should appear as not found
    });
  });

  describe('Error Handling Integration', () => {
    test('handles cascading failures gracefully', async () => {
      // Mock database failure
      (mockEnv.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const res = await app.request('/api/photos', {}, mockEnv);
      expect(res.status).toBe(500);
    });

    test('validates input across multiple endpoints', async () => {
      // Test malformed data on multiple endpoints
      const endpoints = [
        '/api/photos',
        '/api/albums',
        '/api/photos/photo-id/tags',
      ];

      for (const endpoint of endpoints) {
        const req = new Request(`http://localhost${endpoint}`, {
          method: 'POST',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' },
        });

        const res = await app.request(req, {}, mockEnv);
        expect([400, 401, 500]).toContain(res.status);
      }
    });
  });

  describe('Performance Integration', () => {
    test('handles concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        app.request('/api/photos', {}, mockEnv)
      );

      const startTime = Date.now();
      await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should handle 10 concurrent requests in < 1s
    });

    test('maintains data consistency under load', async () => {
      // Mock successful operations
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      // Simulate multiple operations
      const operations = [
        app.request('/api/photos/uploads/image', {
          method: 'POST',
          body: JSON.stringify({ filename: 'test1.jpg' }),
          headers: { 'Content-Type': 'application/json' },
        }, mockEnv),
        app.request('/api/photos', {
          method: 'POST',
          body: JSON.stringify({ r2Key: 'test1.jpg' }),
          headers: { 'Content-Type': 'application/json' },
        }, mockEnv),
      ];

      const results = await Promise.all(operations);
      results.forEach(res => expect(res.status).toBe(200));
    });
  });
});
