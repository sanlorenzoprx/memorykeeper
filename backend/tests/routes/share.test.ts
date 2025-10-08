import { describe, test, expect, vi } from 'vitest';
import { Hono } from 'hono';
import share from '../../src/routes/share';
import type { Env } from '../../src/env';

const app = new Hono<{ Bindings: Env }>();
app.route('/share', share);

describe('Share Routes', () => {
  test('GET /share/:token - returns 404 for missing share', async () => {
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any,
    } as any;

    const res = await app.request('/share/nonexistent', { headers: { 'CF-Connecting-IP': '1.2.3.4' } }, mockEnv);
    expect(res.status).toBe(404);
  });

  test('GET /share/:token - returns 410 for expired share', async () => {
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn()
          // first call: fetch share by token with expires_at
          .mockReturnValueOnce({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              type: 'photo',
              target_id: 'p1',
              expires_at: new Date(Date.now() - 1000).toISOString(),
            }),
          }),
      } as any,
    } as any;

    const res = await app.request('/share/expiredtoken', { headers: { 'CF-Connecting-IP': '5.6.7.8' } }, mockEnv);
    expect(res.status).toBe(410);
  });

  test('GET /share/:token - returns photo data when valid and not expired', async () => {
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn()
          // share
          .mockReturnValueOnce({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              type: 'photo',
              target_id: 'p1',
              expires_at: new Date(Date.now() + 1000 * 60).toISOString(),
            }),
          })
          // photo
          .mockReturnValueOnce({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 'p1',
              r2_key: 'photos/u/1.jpg',
              alt_text: 'alt',
              transcription_text: 'caption',
              created_at: new Date().toISOString(),
            }),
          }),
      } as any,
    } as any;

    const res = await app.request('/share/valid', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('photo');
    expect(body.data.id).toBe('p1');
  });
});