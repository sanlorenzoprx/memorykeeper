import type { Env } from '../env';

export interface UserPlan {
  user_id: string;
  plan_type: 'free' | 'premium_monthly' | 'premium_yearly';
  transcription_seconds_used: number;
  transcription_seconds_limit: number;
  transcription_reset_date: string;
  plan_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TranscriptionLimit {
  canTranscribe: boolean;
  remainingSeconds: number;
  totalLimit: number;
  usedSeconds: number;
  resetDate: string;
  upgradeRequired: boolean;
}

/**
 * Get or create user plan information
 */
export async function getUserPlan(env: Env, userId: string): Promise<UserPlan> {
  // First, ensure user exists in plans table
  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_plans (user_id, plan_type, transcription_seconds_used, transcription_seconds_limit, transcription_reset_date)
    VALUES (?, 'free', 0, 900, datetime('now', 'start of day', 'weekday 1', '-7 days'))
  `).bind(userId).run();

  // Get current plan
  const plan = await env.DB.prepare(`
    SELECT * FROM user_plans WHERE user_id = ?
  `).bind(userId).first<UserPlan>();

  if (!plan) {
    throw new Error('Failed to get or create user plan');
  }

  // Check if plan has expired and reset if needed
  const now = new Date();
  const resetDate = new Date(plan.transcription_reset_date);
  const planExpiresAt = plan.plan_expires_at ? new Date(plan.plan_expires_at) : null;

  // If it's a new week and user is free, reset usage
  if (plan.plan_type === 'free' && now >= resetDate) {
    await env.DB.prepare(`
      UPDATE user_plans
      SET transcription_seconds_used = 0,
          transcription_reset_date = datetime('now', 'start of day', 'weekday 1', '+7 days'),
          updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(userId).run();

    plan.transcription_seconds_used = 0;
    plan.transcription_reset_date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Next Monday
  }

  // If premium plan has expired, downgrade to free
  if (planExpiresAt && now >= planExpiresAt && plan.plan_type !== 'free') {
    await env.DB.prepare(`
      UPDATE user_plans
      SET plan_type = 'free',
          transcription_seconds_limit = 30,
          transcription_seconds_used = 0,
          transcription_reset_date = datetime('now', 'start of month'),
          plan_expires_at = NULL,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(userId).run();

    plan.plan_type = 'free';
    plan.transcription_seconds_limit = 30;
    plan.transcription_seconds_used = 0;
    plan.plan_expires_at = undefined;
  }

  return plan;
}

/**
 * Check if user can transcribe based on their plan and usage
 */
export async function checkTranscriptionLimit(env: Env, userId: string, audioDurationSeconds: number): Promise<TranscriptionLimit> {
  const plan = await getUserPlan(env, userId);

  const remainingSeconds = plan.transcription_seconds_limit - plan.transcription_seconds_used;
  const canTranscribe = remainingSeconds >= audioDurationSeconds;

  return {
    canTranscribe,
    remainingSeconds,
    totalLimit: plan.transcription_seconds_limit,
    usedSeconds: plan.transcription_seconds_used,
    resetDate: plan.transcription_reset_date,
    upgradeRequired: !canTranscribe,
  };
}

/**
 * Update user's transcription usage after successful transcription
 */
export async function updateTranscriptionUsage(
  env: Env,
  userId: string,
  photoId: string,
  audioDurationSeconds: number,
  transcriptionLength: number,
  processingTimeMs: number
): Promise<void> {
  // Update usage in user_plans
  await env.DB.prepare(`
    UPDATE user_plans
    SET transcription_seconds_used = transcription_seconds_used + ?,
        updated_at = datetime('now')
    WHERE user_id = ?
  `).bind(audioDurationSeconds, userId).run();

  // Track usage for analytics
  await env.DB.prepare(`
    INSERT INTO transcription_usage (user_id, photo_id, audio_duration_seconds, transcription_length, processing_time_ms)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, photoId, audioDurationSeconds, transcriptionLength, processingTimeMs).run();
}

/**
 * Award transcription achievements and update streaks
 */
export async function awardTranscriptionAchievements(env: Env, userId: string): Promise<void> {
  // Check for first transcription
  const existingAchievement = await env.DB.prepare(`
    SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = 'FIRST_TRANSCRIPTION'
  `).bind(userId).first();

  if (!existingAchievement) {
    await env.DB.prepare(`
      INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
      VALUES (?, 'FIRST_TRANSCRIPTION', datetime('now'))
    `).bind(userId).run();
  }

  // Update transcription streak
  await env.DB.prepare(`
    INSERT INTO user_streaks (user_id, current_streak, last_activity_date)
    VALUES (?, COALESCE((SELECT current_streak + 1 FROM user_streaks WHERE user_id = ?), 1), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      current_streak = CASE
        WHEN date(last_activity_date) = date('now', '-1 day') THEN current_streak + 1
        ELSE 1
      END,
      last_activity_date = datetime('now')
  `).bind(userId, userId).run();

  // Check for streak achievements
  const streak = await env.DB.prepare(`
    SELECT current_streak FROM user_streaks WHERE user_id = ?
  `).bind(userId).first<{ current_streak: number }>();

  if (streak) {
    const streakAchievements = [
      { streak: 3, achievement: 'TRANSCRIPTION_STREAK_3' },
      { streak: 7, achievement: 'TRANSCRIPTION_STREAK_7' }
    ];

    for (const { streak: requiredStreak, achievement } of streakAchievements) {
      if (streak.current_streak >= requiredStreak) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (?, ?, datetime('now'))
        `).bind(userId, achievement).run();
      }
    }
  }

  // Check for transcription master (100 transcriptions)
  const transcriptionCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM transcription_usage WHERE user_id = ?
  `).bind(userId).first<{ count: number }>();

  if (transcriptionCount && transcriptionCount.count >= 100) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
      VALUES (?, 'TRANSCRIPTION_MASTER', datetime('now'))
    `).bind(userId).run();
  }
}
