import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

const uploadsAudioLimiter = createRateLimitMiddleware('uploads-audio', 10, 60);

// POST /api/audio/uploads - Request a presigned URL for audio upload
app.use('/uploads', uploadsAudioLimiter);
app.post('/uploads', zValidator('json', z.object({ filename: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const { filename } = c.req.valid('json');

    // Basic filename validation: allow common audio types
    const allowed = /\.(webm|wav|mp3|m4a|ogg)$/i.test(filename);
    if (!allowed) {
      return c.json({ error: 'Unsupported audio type. Allowed: webm, wav, mp3, m4a, ogg' }, 400);
    }

    const key = `audio/${userId}/${Date.now()}-${filename}`;

    const signedUrl = await c.env.PHOTOS_BUCKET.createPresignedUrl({
        key,
        action: 'put',
        expiration: 3600, // Expires in 1 hour
    });

    return c.json({ uploadUrl: signedUrl, key });
});

export default app;