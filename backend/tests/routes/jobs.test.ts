import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import jobs from '../../src/routes/jobs';
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

const app = new Hono<{ Bindings: Env }>();
// Mock auth context
app.use('/api/*', (c, next) => {
  c.set('auth', { userId: 'test-user' });
  return next();
});
app.route('/api/jobs', jobs);

describe('Jobs Admin Routes', () => {
  test('GET /api/jobs - lists recent jobs without status filter', async () => {
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [
        { id: 1, kind: 'transcribe', status: 'pending', attempts: 0, created_at: 't', last_error: null, next_run_at: null },
      ] }),
    });

    const res = await app.request('/api/jobs', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.jobs)).toBe(true);
    expect(json.jobs[0]).toHaveProperty('kind', 'transcribe');
  });

  test('GET /api/jobs?status=failed - lists failed jobs', async () => {
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [
        { id: 2, kind: 'transcribe', status: 'failed', attempts: 3, created_at: 't', last_error: 'error', next_run_at: null },
      ] }),
    });

    const res = await app.request('/api/jobs?status=failed', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.jobs)).toBe(true);
    expect(json.jobs[0]).toHaveProperty('status', 'failed');
  });

  test('GET /api/jobs/stats - returns aggregate counts', async () => {
    (mockEnv.DB.prepare as any).mockReturnValueOnce({
      all: vi.fn().mockResolvedValue({ results: [
        { status: 'pending', kind: 'transcribe', count: 2 },
        { status: 'done', kind: 'transcribe', count: 5 },
      ] }),
    });

    const res = await app.request('/api/jobs/stats', {}, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.stats)).toBe(true);
    expect(json.stats[0]).toHaveProperty('status', 'pending');
  });
});