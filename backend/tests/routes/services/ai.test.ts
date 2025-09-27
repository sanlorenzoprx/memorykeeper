import { describe, test, expect, vi } from 'vitest';
import { transcribeAudioAndUpdatePhoto } from '../../src/services/ai';
import type { Env } from '../../src/env';

// Mock env for AI service tests
const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => await fn(mockEnv.DB)),
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

describe('AI Service', () => {
  test('transcribeAudioAndUpdatePhoto - Successful transcription and DB update', async () => {
    const result = await transcribeAudioAndUpdatePhoto(mockEnv, 'mock-key', 'mock-photo-id');
    expect(result).toBe('Mock transcription');
    expect(mockEnv.AI.run).toHaveBeenCalled();
    expect(mockEnv.DB.transaction).toHaveBeenCalled();
  });

  test('transcribeAudioAndUpdatePhoto - Handles empty transcription', async () => {
    (mockEnv.AI.run as any).mockResolvedValueOnce({ text: '' });
    const result = await transcribeAudioAndUpdatePhoto(mockEnv, 'mock-key', 'mock-photo-id');
    expect(result).toBeUndefined();
  });

  test('transcribeAudioAndUpdatePhoto - Throws on R2 not found', async () => {
    (mockEnv.PHOTOS_BUCKET.get as any).mockResolvedValueOnce(null);
    await expect(transcribeAudioAndUpdatePhoto(mockEnv, 'bad-key', 'mock-photo-id')).rejects.toThrow();
  });
});