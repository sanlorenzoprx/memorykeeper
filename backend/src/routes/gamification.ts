import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';
import { getUserPlan } from '../utils/user-plans';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// GET /api/gamification - Get user's streak and achievements
app.get('/', async (c) => {
  const { userId } = c.get('auth');

  const streakResult = await c.env.DB.prepare(
    'SELECT current_streak FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first<{ current_streak: number }>();

  const achievementsResult = await c.env.DB.prepare(
    'SELECT a.name, a.description FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = ?'
  ).bind(userId).all();

  return c.json({
    streak: streakResult?.current_streak || 0,
    achievements: achievementsResult.results || []
  });
});

// POST /api/gamification/actions/:type - Report an action
app.post('/actions/:type', async (c) => {
  const { userId } = c.get('auth');
  const type = c.req.param('type');
  const today = new Date().toISOString().split('T')[0];

  await c.env.DB.transaction(async (tx) => {
    // Update streak
    const streak = await tx.prepare(
      'SELECT last_activity_date, current_streak FROM user_streaks WHERE user_id = ?'
    ).bind(userId).first<{ last_activity_date: string; current_streak: number }>();

    let newStreak = 1;
    if (streak) {
      if (streak.last_activity_date === today) {
        // Already active today, do nothing to streak
        newStreak = streak.current_streak;
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (streak.last_activity_date === yesterday.toISOString().split('T')[0]) {
          newStreak = streak.current_streak + 1; // Continue streak
        } else {
          newStreak = 1; // Reset streak
        }
      }
    }

    await tx.prepare(
      'INSERT OR REPLACE INTO user_streaks (user_id, current_streak, last_activity_date) VALUES (?, ?, ?)'
    ).bind(userId, newStreak, today).run();

    // Unlock achievements based on type
    let achievementId: string | null = null;
    if (type === 'digitize') achievementId = 'FIRST_UPLOAD';
    else if (type === 'caption') achievementId = 'FIRST_CAPTION';
    else if (type === 'share') achievementId = 'FIRST_SHARE';

    if (achievementId) {
      await tx.prepare(
        'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)'
      ).bind(userId, achievementId, new Date().toISOString()).run();
    }
  });

  return c.json({ success: true });
});

// GET /api/gamification/transcription-usage - Get transcription usage and limits
app.get('/transcription-usage', async (c) => {
  const { userId } = c.get('auth');

  const plan = await getUserPlan(c.env, userId);

  // Get recent transcription activity
  const recentTranscriptions = await c.env.DB.prepare(`
    SELECT audio_duration_seconds, transcription_length, created_at
    FROM transcription_usage
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(userId).all();

  // Note: Removed achievements and streak tracking to focus on timer-based motivation

  return c.json({
    plan: {
      type: plan.plan_type,
      transcription_seconds_used: plan.transcription_seconds_used,
      transcription_seconds_limit: plan.transcription_seconds_limit,
      transcription_reset_date: plan.transcription_reset_date,
      remaining_seconds: Math.max(0, plan.transcription_seconds_limit - plan.transcription_seconds_used)
    },
    recent_activity: recentTranscriptions.results || []
  });
});

// POST /api/gamification/actions/transcribe - Track transcription for analytics
app.post('/actions/transcribe', async (c) => {
  const { userId } = c.get('auth');

  // Simple tracking for analytics - no gamification
  console.log(`User ${userId} performed transcription action`);

  return c.json({ success: true });
});

export default app;