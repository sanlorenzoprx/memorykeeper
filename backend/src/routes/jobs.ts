import { Hono } from 'hono';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string; isAdmin?: boolean } } }>();

// GET /api/jobs - Inspect job statuses
app.get('/', async (c) => {
  const auth = c.get('auth');
  if (!auth?.isAdmin) {
    return c.json({ error: 'Forbidden: Admins only' }, 403);
  }

  const { status, kind, limit = '50', offset = '0' } = c.req.query();
  const lim = Math.max(1, Math.min(Number(limit) || 50, 200));
  const off = Math.max(0, Number(offset) || 0);

  let query = `
    SELECT id, kind, status, attempts, created_at, last_error, next_run_at
    FROM jobs
    WHERE 1=1
  `;
  const binds: any[] = [];

  if (status) {
    query += ` AND status = ?`;
    binds.push(status);
  }
  if (kind) {
    query += ` AND kind = ?`;
    binds.push(kind);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  binds.push(lim, off);

  const { results } = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json({ jobs: results || [] });
});

// GET /api/jobs/stats - Aggregate counts by status and kind
app.get('/stats', async (c) => {
  const auth = c.get('auth');
  if (!auth?.isAdmin) {
    return c.json({ error: 'Forbidden: Admins only' }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT status, kind, COUNT(*) as count
    FROM jobs
    GROUP BY status, kind
    ORDER BY status, kind
  `).all();

  return c.json({ stats: results || [] });
});

export default app;