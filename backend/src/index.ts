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

// Apply CORS middleware to all routes
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'https://your-production-frontend.com'],
  credentials: true,
}));

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
        "SELECT id, kind, payload FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20"
    ).all();

    for (const job of results || []) {
      const id = job.id as number;
      const kind = job.kind as string;
      const payload = JSON.parse(job.payload as string);

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
        await env.DB.prepare("UPDATE jobs SET status = 'failed' WHERE id = ?").bind(id).run();
      }
    }
  }
};