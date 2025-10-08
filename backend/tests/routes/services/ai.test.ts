import { describe, test, expect, vi, beforeEach } from 'vitest';
import { transcribeAudioAndUpdatePhoto } from '../../src/services/ai';
import type { Env } from '../../src/env';

// Mock env for AI service tests
let mockEnv: Env;

beforeEach(() => {
  const prepareMock = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue({ owner_id: 'test-user' }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  });

  mockEnv = {
    DB: {
      prepare: prepareMock,
      transaction: vi.fn().mockImplementation(async (fn) => await fn({
        prepare: prepareMock
      } as any)),
    } as any,
    PHOTOS_BUCKET: {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
    } as any,
    AI_MODEL_WHISPER: '@cf/openai/whisper',
    AI: {
      run: vi.fn().mockResolvedValue({ text: 'Mock transcription' }),
    } as any,
    CLERK_JWKS_URI: 'mock',
    CLERK_ISSUER: 'mock',
  };
});

describe('AI Service', () => {
  test('transcribeAudioAndUpdatePhoto - Successful transcription and DB update', async () => {
    const result = await transcribeAudioAndUpdatePhoto(mockEnv, 'mock-key', 'mock-photo-id');
    expect(result).toBe('Mock transcription');
    expect(mockEnv.AI.run).toHaveBeenCalled();
    expect(mockEnv.DB.transaction).toHaveBeenCalled();
  });

  test('transcribeAudioAndUpdatePhoto - Handles empty transcription gracefully', async () => {
    (mockEnv.AI.run as any).mockResolvedValueOnce({ text: '' });
    const result = await transcribeAudioAndUpdatePhoto(mockEnv, 'mock-key', 'mock-photo-id');
    expect(result).toBeNull();
  });

  test('transcribeAudioAndUpdatePhoto - Retries on failure and eventually succeeds', async () => {
    // Fail twice, then succeed
    (mockEnv.AI.run as any)
      .mockRejectedValueOnce(new Error('Transient error 1'))
      .mockRejectedValueOnce(new Error('Transient error 2'))
      .mockResolvedValueOnce({ text: 'Recovered transcription' });
    const result = await transcribeAudioAndUpdatePhoto(mockEnv, 'mock-key', 'mock-photo-id');
    expect(result).toBe('Recovered transcription');
    expect((mockEnv.AI.run as any).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test('transcribeAudioAndUpdatePhoto - Throws on R2 not found', async () => {
    (mockEnv.PHOTOS_BUCKET.get as any).mockResolvedValueOnce(null);
    await expect(transcribeAudioAndUpdatePhoto(mockEnv, 'bad-key', 'mock-photo-id')).rejects.toThrow();
  });
});