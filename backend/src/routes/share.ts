import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

/**
 * Simple in-memory rate limiter for the public share route.
 * Note: Module-scoped maps can persist across invocations in Workers,
 * but are not guaranteed. This provides basic protection without external state.
 */
type Counter = { count: number; resetAt: number };
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;           // 60 requests/minute per IP
const ipCounters = new Map<string, Counter>();

const rateLimiter = createMiddleware(async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const current = ipCounters.get(ip);
  if (!current || now > current.resetAt) {
    ipCounters.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    if (current.count >= RATE_LIMIT_MAX) {
      return c.json({ error: 'Too many requests' }, 429);
    }
    current.count += 1;
    ipCounters.set(ip, current);
  }
  await next();
});

// GET /share/:token - Get shared content (public route)
app.get('/:token', rateLimiter, async (c) => {
  const token = c.req.param('token');

  // Only return shares that haven't expired
  const share = await c.env.DB.prepare(
    'SELECT type, target_id, expires_at FROM shares WHERE share_token = ?'
  ).bind(token).first<{ type: string; target_id: string; expires_at: string | null }>();

  if (!share) {
    return c.json({ error: 'Share not found' }, 404);
  }

  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Share link expired' }, 410);
  }

  if (share.type === 'photo') {
    const photo = await c.env.DB.prepare(
      'SELECT id, r2_key, alt_text, transcription_text, created_at FROM photos WHERE id = ?'
    ).bind(share.target_id).first();
    return c.json({ type: 'photo', data: photo });
  }

  return c.json({ error: 'Unsupported share type' }, 400);
});

// POST /api/share - Create a share link (authenticated)
app.post(
  '/',
  zValidator('json', z.object({ type: z.enum(['photo', 'album']), targetId: z.string() })),
  async (c) => {
    const { userId } = c.get('auth');
    const { type, targetId } = c.req.valid('json');
    const id = crypto.randomUUID();
    const shareToken = crypto.randomUUID();
    const now = new Date();
    // Default share expiration: 7 days
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.prepare(
      'INSERT INTO shares (id, owner_id, type, target_id, share_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, userId, type, targetId, shareToken, now.toISOString(), expires).run();

    // Trigger gamification share action
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)'
    ).bind(userId, 'FIRST_SHARE', now.toISOString()).run();

    return c.json({ shareToken, shareUrl: `/share/${shareToken}`, expiresAt: expires });
  }
);

export default app;