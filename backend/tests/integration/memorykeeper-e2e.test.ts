import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import photos from '../../src/routes/photos';
import albums from '../../src/routes/albums';
import audio from '../../src/routes/audio';
import { transcribeAudioAndUpdatePhoto } from '../../src/services/ai';
import { checkTranscriptionLimit, updateTranscriptionUsage } from '../../src/utils/user-plans';
import type { Env } from '../../src/env';

// Mock environment for comprehensive e2e testing
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
    createPresignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com/upload'),
    get: vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)), // Mock audio buffer
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  } as any,
  AI_MODEL_WHISPER: '@cf/openai/whisper',
  AI: {
    run: vi.fn().mockResolvedValue({ text: 'This is a test transcription of a memory' }),
  } as any,
  CLERK_JWKS_URI: 'mock',
  CLERK_ISSUER: 'mock',
};

// Create test app with all routes
const app = new Hono<{ Bindings: Env }>();

// Mock auth middleware for tests
app.use('/api/*', (c, next) => {
  c.set('auth', { userId: 'test-user-123' });
  return next();
});

app.route('/api/photos', photos);
app.route('/api/albums', albums);
app.route('/api/audio', audio);

// Mock the user-plans utilities
vi.mock('../../src/utils/user-plans', () => ({
  checkTranscriptionLimit: vi.fn().mockResolvedValue({
    canTranscribe: true,
    usedSeconds: 0,
    remainingSeconds: 1800, // 30 minutes
    totalLimit: 1800,
    resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  updateTranscriptionUsage: vi.fn().mockResolvedValue(undefined),
}));

describe('MemoryKeeper End-to-End Integration Tests', () => {
  let photoId: string;
  let albumId: string;
  let audioKey: string;

  beforeEach(() => {
    vi.clearAllMocks();
    photoId = 'photo-' + Math.random().toString(36).substr(2, 9);
    albumId = 'album-' + Math.random().toString(36).substr(2, 9);
    audioKey = `audio/${photoId}.mp3`;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Photo Upload and Transcription Workflow', () => {
    test('should complete full workflow: upload -> create album -> add to album -> upload audio -> transcribe', async () => {
      // Step 1: Get presigned URL for photo upload
      const uploadRequest = new Request('http://localhost/api/photos/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ filename: 'test-photo.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const uploadResponse = await app.request(uploadRequest, {}, mockEnv);
      expect(uploadResponse.status).toBe(200);

      const uploadData = await uploadResponse.json();
      expect(uploadData).toHaveProperty('uploadUrl');
      expect(uploadData).toHaveProperty('key');

      // Step 2: Create photo record in database
      const createPhotoRequest = new Request('http://localhost/api/photos', {
        method: 'POST',
        body: JSON.stringify({ r2Key: uploadData.key }),
        headers: { 'Content-Type': 'application/json' },
      });

      const createPhotoResponse = await app.request(createPhotoRequest, {}, mockEnv);
      expect(createPhotoResponse.status).toBe(200);

      const createPhotoData = await createPhotoResponse.json();
      expect(createPhotoData).toHaveProperty('id');
      photoId = createPhotoData.id;

      // Step 3: Create an album
      const createAlbumRequest = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Album', description: 'E2E Test Album' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const createAlbumResponse = await app.request(createAlbumRequest, {}, mockEnv);
      expect(createAlbumResponse.status).toBe(201);

      const createAlbumData = await createAlbumResponse.json();
      expect(createAlbumData).toHaveProperty('id');
      albumId = createAlbumData.id;

      // Step 4: Add photo to album
      const addToAlbumRequest = new Request(`http://localhost/api/albums/${albumId}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photoIds: [photoId] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const addToAlbumResponse = await app.request(addToAlbumRequest, {}, mockEnv);
      expect(addToAlbumResponse.status).toBe(200);

      // Step 5: Get presigned URL for audio upload
      const audioUploadRequest = new Request('http://localhost/api/audio/upload', {
        method: 'POST',
        body: JSON.stringify({ filename: 'test-audio.mp3', photoId }),
        headers: { 'Content-Type': 'application/json' },
      });

      const audioUploadResponse = await app.request(audioUploadRequest, {}, mockEnv);
      expect(audioUploadResponse.status).toBe(200);

      const audioUploadData = await audioUploadResponse.json();
      expect(audioUploadData).toHaveProperty('uploadUrl');
      expect(audioUploadData).toHaveProperty('key');
      audioKey = audioUploadData.key;

      // Step 6: Transcribe the audio
      const transcribeRequest = new Request(`http://localhost/api/photos/${photoId}/transcribe`, {
        method: 'POST',
        body: JSON.stringify({ r2Key: audioKey }),
        headers: { 'Content-Type': 'application/json' },
      });

      const transcribeResponse = await app.request(transcribeRequest, {}, mockEnv);
      expect(transcribeResponse.status).toBe(200);

      const transcribeData = await transcribeResponse.json();
      expect(transcribeData).toHaveProperty('message', 'Transcription process completed successfully');

      // Step 7: Verify photo has transcription
      const getPhotoRequest = new Request(`http://localhost/api/photos?limit=10&offset=0`, {
        method: 'GET',
      });

      const getPhotoResponse = await app.request(getPhotoRequest, {}, mockEnv);
      expect(getPhotoResponse.status).toBe(200);

      const photosData = await getPhotoResponse.json();
      expect(photosData).toHaveProperty('photos');
      expect(Array.isArray(photosData.photos)).toBe(true);

      // Verify transcription was saved (mocked, but function was called)
      expect(mockEnv.AI.run).toHaveBeenCalledWith('@cf/openai/whisper', {
        audio: expect.any(Array),
      });

      // Verify usage tracking was called
      expect(checkTranscriptionLimit).toHaveBeenCalledWith(
        mockEnv,
        'test-user-123',
        25 // estimated duration
      );
      expect(updateTranscriptionUsage).toHaveBeenCalled();

      console.log('✅ Complete workflow test passed!');
    });
  });

  describe('Transcription Limits and Error Handling', () => {
    test('should handle transcription limit exceeded', async () => {
      // Mock limit check to fail
      vi.mocked(checkTranscriptionLimit).mockResolvedValueOnce({
        canTranscribe: false,
        usedSeconds: 1800, // Used all 30 minutes
        remainingSeconds: 0,
        totalLimit: 1800,
        resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const transcribeRequest = new Request(`http://localhost/api/photos/${photoId}/transcribe`, {
        method: 'POST',
        body: JSON.stringify({ r2Key: audioKey }),
        headers: { 'Content-Type': 'application/json' },
      });

      const transcribeResponse = await app.request(transcribeRequest, {}, mockEnv);
      expect(transcribeResponse.status).toBe(403);

      const errorData = await transcribeResponse.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData).toHaveProperty('usage');
      expect(errorData.usage).toHaveProperty('remaining', 0);

      console.log('✅ Transcription limit error handling test passed!');
    });

    test('should handle audio file not found', async () => {
      // Mock R2 get to return null (file not found)
      vi.mocked(mockEnv.PHOTOS_BUCKET.get).mockResolvedValueOnce(null);

      const transcribeRequest = new Request(`http://localhost/api/photos/${photoId}/transcribe`, {
        method: 'POST',
        body: JSON.stringify({ r2Key: 'nonexistent-audio.mp3' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const transcribeResponse = await app.request(transcribeRequest, {}, mockEnv);
      expect(transcribeResponse.status).toBe(500);

      console.log('✅ Audio file not found error handling test passed!');
    });
  });

  describe('Album Management Integration', () => {
    test('should create album and manage photos', async () => {
      // Create album
      const createAlbumRequest = new Request('http://localhost/api/albums', {
        method: 'POST',
        body: JSON.stringify({ name: 'Integration Test Album', description: 'Testing album creation' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const createAlbumResponse = await app.request(createAlbumRequest, {}, mockEnv);
      expect(createAlbumResponse.status).toBe(201);

      const createAlbumData = await createAlbumResponse.json();
      expect(createAlbumData).toHaveProperty('id');
      albumId = createAlbumData.id;

      // Get albums list
      const getAlbumsRequest = new Request('http://localhost/api/albums', {
        method: 'GET',
      });

      const getAlbumsResponse = await app.request(getAlbumsRequest, {}, mockEnv);
      expect(getAlbumsResponse.status).toBe(200);

      const albumsData = await getAlbumsResponse.json();
      expect(albumsData).toHaveProperty('albums');
      expect(Array.isArray(albumsData.albums)).toBe(true);

      console.log('✅ Album management integration test passed!');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple transcription requests efficiently', async () => {
      const startTime = performance.now();

      // Create multiple transcription requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const testPhotoId = `perf-photo-${i}`;
        const testAudioKey = `audio/perf-${i}.mp3`;

        const transcribeRequest = new Request(`http://localhost/api/photos/${testPhotoId}/transcribe`, {
          method: 'POST',
          body: JSON.stringify({ r2Key: testAudioKey }),
          headers: { 'Content-Type': 'application/json' },
        });

        promises.push(app.request(transcribeRequest, {}, mockEnv));
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`✅ Performance test completed in ${duration.toFixed(2)}ms for 5 concurrent requests`);

      // Should complete within reasonable time (adjust based on your requirements)
      expect(duration).toBeLessThan(5000); // Less than 5 seconds for 5 requests
    });
  });
});
