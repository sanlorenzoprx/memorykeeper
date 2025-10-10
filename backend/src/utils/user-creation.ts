import type { Env } from '../env';

/**
 * Ensures a user record exists in the database for the given user ID.
 * Creates the user and their default plan if they don't exist.
 * @param env - The Cloudflare environment bindings
 * @param userId - The Clerk user ID
 * @param email - The user's email address (optional)
 */
export async function ensureUserExists(env: Env, userId: string, email?: string): Promise<void> {
  // Check if user already exists
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string }>();

  if (existingUser) {
    return; // User already exists
  }

  // Create user and their default plan in a transaction
  await env.DB.transaction(async (tx) => {
    // Insert user record
    await tx.prepare(
      'INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)'
    ).bind(userId, email || null, new Date().toISOString()).run();

    // Create default free plan for user
    await tx.prepare(
      'INSERT INTO user_plans (user_id, plan_tier, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, 'free', new Date().toISOString(), new Date().toISOString()).run();

    // Initialize user streak
    await tx.prepare(
      'INSERT INTO user_streaks (user_id, current_streak, last_activity_date) VALUES (?, ?, ?)'
    ).bind(userId, 0, new Date().toISOString().split('T')[0]).run();
  });

  console.log(`Created user record for ${userId}`);
}
