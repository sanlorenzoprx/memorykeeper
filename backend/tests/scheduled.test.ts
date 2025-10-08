import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock services/ai to control behavior
vi.mock('../src/services/ai', () => ({
  transcribeAudioAndUpdatePhoto: vi.fn().mockRejectedValue(new Error('Temporary error')),
}));

import workerApp from '../src/index';
import type { Env } from '../src/env';

function makeEnvWithJobs(job: any, updates: any[] = []): Env {
  const prepareMock = vi.fn((query: string) => {
    if (query.startsWith('SELECT id, kind')) {
      return {
        all: vi.fn().mockResolvedValue({ results: [job] }),
      } as any;
    }
    // Capture update calls
    updates.push(query);
    return {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as any;
  });

  return {
    DB: { prepare: prepareMock, transaction: vi.fn() } as any,
    PHOTOS_BUCKET: {} as any,
    AI: {} as any,
    CLERK_JWKS_URI: 'mock',
    CLERK_ISSUER: 'mock',
    ANALYTICS: { writeDataPoint: vi.fn() } as any,
  };
}

describe('Scheduled job retry/backoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('retryable error increments attempts and sets next_run_at', async () => {
    const job = {
      id: 1,
      kind: 'transcribe',
      payload: JSON.stringify({ r2Key: 'k', photoId: 'p1' }),
      attempts: 0,
      max_attempts: 3,
      next_run_at: null,
      created_at: new Date().toISOString(),
    };

    const updates: string[] = [];
    const env = makeEnvWithJobs(job, updates);

    await workerApp.scheduled({} as any, env, {} as any);

    // Expect an update that sets attempts and next_run_at
    const matched = updates.some((q) => q.includes('UPDATE jobs SET attempts =') && q.includes('next_run_at'));
    expect(matched).toBe(true);
  });

  test('non-retryable error marks job failed', async () => {
    // Change mock to throw non-retryable error
    const ai = await import('../src/services/ai');
    (ai.transcribeAudioAndUpdatePhoto as any).mockRejectedValueOnce(new Error('Not found'));

    const job = {
      id: 2,
      kind: 'transcribe',
      payload: JSON.stringify({ r2Key: 'k', photoId: 'p1' }),
      attempts: 2,
      max_attempts: 3,
      next_run_at: null,
      created_at: new Date().toISOString(),
    };

    const updates: string[] = [];
    const env = makeEnvWithJobs(job, updates);

    await workerApp.scheduled({} as any, env, {} as any);

    // Expect status failed update
    const matched = updates.some((q) => q.includes("UPDATE jobs SET status = 'failed'")); 
    expect(matched).toBe(true);
  });

  test('max_attempts reached -> mark failed even for retryable error', async () => {
    const job = {
      id: 3,
      kind: 'transcribe',
      payload: JSON.stringify({ r2Key: 'k', photoId: 'p1' }),
      attempts: 2, // next attempt would be 3, equals max_attempts
      max_attempts: 3,
      next_run_at: null,
      created_at: new Date().toISOString(),
    };

    const updates: string[] = [];
    const env = makeEnvWithJobs(job, updates);

    await workerApp.scheduled({} as any, env, {} as any);

    // Expect status failed update instead of setting next_run_at
    const failed = updates.some((q) => q.includes("UPDATE jobs SET status = 'failed'"));
    const scheduled = updates.some((q) => q.includes('next_run_at'));
    expect(failed).toBe(true);
    expect(scheduled).toBe(false);
  });
});