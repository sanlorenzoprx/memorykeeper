import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// POST /api/audio/uploads - Request a presigned URL for audio upload
app.post('/uploads', zValidator('json', z.object({ filename: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const { filename } = c.req.valid('json');
    const key = `audio/${userId}/${Date.now()}-${filename}`;

    const signedUrl = await c.env.PHOTOS_BUCKET.createPresignedUrl({
        key,
        action: 'put',
        expiration: 3600, // Expires in 1 hour
    });

    return c.json({ uploadUrl: signedUrl, key });
});

export default app;