import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';

/**
 * Simple D1-based per-user rate limiter.
 * Creates/updates a counter in a 1-minute window per (user_id, route_key).
 */
export function createRateLimitMiddleware(routeKey: string, limit: number, windowSec = 60) {
  return createMiddleware<{ Bindings: Env; Variables: { auth: { userId: string } } }>(async (c, next) => {
    const { userId } = c.get('auth');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / (windowSec * 1000)) * (windowSec * 1000)).toISOString();

    // Try to read current window count
    const row = await c.env.DB.prepare(
      'SELECT count FROM rate_limits WHERE user_id = ? AND route_key = ? AND window_start = ?'
    ).bind(userId, routeKey, windowStart).first<{ count: number }>();

    const currentCount = Number(row?.count ?? 0);
    if (currentCount >= limit) {
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    if (row) {
      await c.env.DB.prepare(
        'UPDATE rate_limits SET count = count + 1 WHERE user_id = ? AND route_key = ? AND window_start = ?'
      ).bind(userId, routeKey, windowStart).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO rate_limits (user_id, route_key, window_start, count) VALUES (?, ?, ?, ?)'
      ).bind(userId, routeKey, windowStart, 1).run();
    }

    await next();
  });
}