import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import photos from './routes/photos';
import audio from './routes/audio';
import albums from './routes/albums';
import share from './routes/share';
import gamification from './routes/gamification';
import { performR2Delete } from './utils/jobs';
import { transcribeAudioAndUpdatePhoto } from './services/ai';
import type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

// Apply CORS middleware to all routes, reading allowed origins from environment
app.use('*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin: origins,
    credentials: true,
  })(c, next);
});

app.get('/', (c) => {
  return c.json({
    message: 'Welcome to the MemoryKeeper API!',
    version: '1.0.0',
    status: 'ok',
  });
});

// Public share route - does not require authentication
app.route('/share', share);

// Apply auth middleware to all /api routes
app.use('/api/*', authMiddleware);

// Authenticated API routes
app.route('/api/photos', photos);
app.route('/api/audio', audio);
app.route('/api/albums', albums);
app.route('/api/gamification', gamification);
app.route('/api/tags', photos); // Re-exporting for /api/tags

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Process up to 20 pending jobs per cron run
    const { results } = await env.DB.prepare(
        "SELECT id, kind, payload, attempts FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20"
    ).all();

    for (const job of results || []) {
      const id = job.id as number;
      const kind = job.kind as string;
      const payload = JSON.parse(job.payload as string);
      const attempts = Number((job as any).attempts ?? 0);

      try {
        if (kind === 'r2-delete') {
          await performR2Delete(env, payload.r2Key);
        } else if (kind === 'transcribe') {
          await transcribeAudioAndUpdatePhoto(env, payload.r2Key, payload.photoId);
        }
        // Add other job kinds here, e.g., 'ai-enhance'

        await env.DB.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").bind(id).run();
      } catch (e) {
        console.error(`Job ${id} of kind ${kind} failed:`, e);
        // Simple retry policy for transcription jobs: up to 3 attempts
        if (kind === 'transcribe' && attempts < 3) {
          await env.DB.prepare("UPDATE jobs SET attempts = attempts + 1, last_error = ? WHERE id = ?")
            .bind(String(e), id)
            .run();
        } else {
          await env.DB.prepare("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?")
            .bind(String(e), id)
            .run();
        }
      }
    }
  }
};