import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// GET /share/:token - Get shared content (public route)
app.get('/:token', async (c) => {
  const token = c.req.param('token');

  const share = await c.env.DB.prepare(
    `SELECT type, target_id, expires_at, revoked_at
     FROM shares
     WHERE share_token = ?`
  ).bind(token).first<{ type: string; target_id: string; expires_at: string | null; revoked_at: string | null }>();

  if (!share) {
    return c.json({ error: 'Share not found' }, 404);
  }

  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');

  // Enforce revocation and expiry
  const now = new Date();
  if (share.revoked_at) {
    return c.json({ error: 'Share revoked' }, 404);
  }
  if (share.expires_at && new Date(share.expires_at) < now) {
    return c.json({ error: 'Share expired' }, 404);
  }

  if (share.type === 'photo') {
    const photo = await c.env.DB.prepare(
      'SELECT id, r2_key, alt_text, transcription_text, created_at FROM photos WHERE id = ?'
    ).bind(share.target_id).first();
    return c.json({ type: 'photo', data: photo });
  } else if (share.type === 'album') {
    const album = await c.env.DB.prepare(
      'SELECT id, name, description, created_at FROM albums WHERE id = ?'
    ).bind(share.target_id).first();

    if (!album) {
      return c.json({ error: 'Album not found' }, 404);
    }

    const photosRes = await c.env.DB.prepare(
      `SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at
       FROM photos p
       JOIN album_photos ap ON p.id = ap.photo_id
       WHERE ap.album_id = ?
       ORDER BY ap.sort_order ASC`
    ).bind(share.target_id).all();

    return c.json({ type: 'album', data: { album, photos: photosRes.results || [] } });
  }

  return c.json({ error: 'Unsupported share type' }, 400);
});

// POST /api/share - Create a share link (authenticated)
app.post('/', zValidator('json', z.object({
  type: z.enum(['photo', 'album']),
  targetId: z.string(),
  expiresAt: z.string().datetime().optional(),
})), async (c) => {
  const { userId } = c.get('auth');
  const { type, targetId, expiresAt } = c.req.valid('json');
  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO shares (id, owner_id, type, target_id, share_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, type, targetId, shareToken, new Date().toISOString(), expiresAt || null).run();

  // Trigger gamification share action
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)'
  ).bind(userId, 'FIRST_SHARE', new Date().toISOString()).run();

  return c.json({ shareToken, shareUrl: `/share/${shareToken}`, expiresAt: expiresAt || null });
});

// DELETE /api/share/:token - Revoke a share link (authenticated)
app.delete('/:token', async (c) => {
  const { userId } = c.get('auth');
  const token = c.req.param('token');

  const share = await c.env.DB.prepare(
    'SELECT id, owner_id, revoked_at FROM shares WHERE share_token = ?'
  ).bind(token).first<{ id: string; owner_id: string; revoked_at: string | null }>();

  if (!share) {
    return c.json({ error: 'Share not found' }, 404);
  }
  if (share.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (share.revoked_at) {
    return c.json({ success: true, message: 'Already revoked' });
  }

  await c.env.DB.prepare(
    'UPDATE shares SET revoked_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), share.id).run();

  return c.json({ success: true });
});

export default app;