import { Hono } from 'hono';
import type { Env } from '../env';

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

export default app;