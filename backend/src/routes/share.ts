import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// GET /share/:token - Get shared content (public route)
app.get('/:token', async (c) => {
  const token = c.req.param('token');

  const share = await c.env.DB.prepare(
    'SELECT type, target_id, owner_id FROM shares WHERE share_token = ?'
  ).bind(token).first<{ type: string; target_id: string; owner_id: string }>();

  if (!share) {
    return c.json({ error: 'Share not found' }, 404);
  }

  if (share.type === 'photo') {
    const photo = await c.env.DB.prepare(
      'SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at, ' +
      'af.r2_key as audio_r2_key, af.transcription_text as audio_transcription ' +
      'FROM photos p ' +
      'LEFT JOIN audio_files af ON p.id = af.photo_id ' +
      'WHERE p.id = ?'
    ).bind(share.target_id).first();

    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    // Increment view count for analytics
    await c.env.DB.prepare(
      'UPDATE shares SET view_count = COALESCE(view_count, 0) + 1 WHERE share_token = ?'
    ).bind(token).run();

    return c.json({
      type: 'photo',
      data: photo,
      shareInfo: {
        shareToken: token,
        createdAt: share.created_at,
        viewCount: (await c.env.DB.prepare(
          'SELECT view_count FROM shares WHERE share_token = ?'
        ).bind(token).first<{ view_count: number }>())?.view_count || 0
      }
    });
  }

  return c.json({ error: 'Unsupported share type' }, 400);
});

// POST /api/share - Create a share link (authenticated)
app.post('/', zValidator('json', z.object({ type: z.enum(['photo', 'album']), targetId: z.string() })), async (c) => {
  const { userId } = c.get('auth');
  const { type, targetId } = c.req.valid('json');

  // Check sharing limits for free users
  const userShares = await c.env.DB.prepare(
    'SELECT COUNT(*) as share_count FROM shares WHERE owner_id = ? AND created_at > datetime("now", "-30 days")'
  ).bind(userId).first<{ share_count: number }>();

  const shareCount = userShares?.share_count || 0;

  // Free users: 8 shares per month, premium users: unlimited
  // TODO: Implement premium user detection
  const isPremiumUser = false; // For now, assume free user
  const maxShares = isPremiumUser ? Infinity : 8;

  if (shareCount >= maxShares) {
    return c.json({
      error: 'Sharing limit reached',
      message: 'Free users can share up to 8 items per month. Upgrade to Memory Locker for unlimited sharing.',
      upgradeRequired: true,
      usage: {
        current: shareCount,
        limit: maxShares,
        bonusEarned: 0
      }
    }, 402);
  }

  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO shares (id, owner_id, type, target_id, share_token, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, type, targetId, shareToken, new Date().toISOString()).run();

  // Calculate sharing bonus based on count
  const bonusImages = Math.floor(shareCount / 3) * 2 + Math.floor(shareCount / 6) * 3;

  // Trigger gamification share action and potential bonuses
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)'
  ).bind(userId, 'FIRST_SHARE', new Date().toISOString()).run();

  // Update user streak for sharing
  await c.env.DB.prepare(`
    INSERT INTO user_streaks (user_id, current_streak, last_activity_date)
    VALUES (?, COALESCE((SELECT current_streak + 1 FROM user_streaks WHERE user_id = ?), 1), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      current_streak = current_streak + 1,
      last_activity_date = ?
  `).bind(userId, userId, new Date().toISOString(), new Date().toISOString()).run();

  return c.json({
    shareToken,
    shareUrl: `/share/${shareToken}`,
    usage: {
      current: shareCount + 1,
      limit: maxShares,
      bonusEarned: bonusImages
    }
  });
});

export default app;