import type { Env } from '../env';

export async function checkTranscriptionLimit(env: Env, userId: string, duration: number) {
  // Get user's plan tier (default to 'free')
  const plan = await env.DB.prepare(
    'SELECT plan_tier FROM user_plans WHERE user_id = ?'
  ).bind(userId).first<{ plan_tier: string }>();

  const tier = plan?.plan_tier || 'free';
  const totalLimit = tier === 'pro' ? 3600 * 5 : 30 * 60; // 5 hours for pro, 30 min for free (in seconds)

  // Calculate start and end of current week (Sunday to Sunday)
  const now = new Date();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Get used seconds this week
  const usedResult = await env.DB.prepare(
    'SELECT SUM(audio_duration_seconds) as used FROM transcription_usage WHERE user_id = ? AND created_at >= ? AND created_at < ?'
  ).bind(userId, startOfWeek.toISOString(), endOfWeek.toISOString()).first<{ used: number | null }>();

  const usedSeconds = usedResult?.used || 0;
  const remainingSeconds = totalLimit - usedSeconds;

  const canTranscribe = remainingSeconds >= duration;

  if (!canTranscribe) {
    const error: any = new Error(`Transcription limit exceeded. You have ${Math.floor(remainingSeconds / 60)} minutes remaining this week.`);
    error.upgradeRequired = tier === 'free';
    error.usage = {
      current: usedSeconds,
      limit: totalLimit,
      remaining: remainingSeconds,
      resetDate: endOfWeek.toISOString(),
    };
    throw error;
  }

  return {
    canTranscribe,
    usedSeconds,
    remainingSeconds,
    totalLimit,
    resetDate: endOfWeek.toISOString(),
  };
}

export async function updateTranscriptionUsage(
  env: Env,
  userId: string,
  photoId: string,
  duration: number,
  chars: number,
  processingMs: number
) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO transcription_usage (id, user_id, photo_id, audio_duration_seconds, transcription_length_chars, processing_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, photoId, duration, chars, processingMs, new Date().toISOString()).run();
}
