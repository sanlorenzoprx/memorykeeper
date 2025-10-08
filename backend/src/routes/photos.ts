import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';
import { scheduleR2Delete, scheduleTranscriptionJob } from '../utils/jobs';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// Apply rate limits to sensitive endpoints
const uploadsImageLimiter = createRateLimitMiddleware('uploads-image', 10, 60);
const transcribeLimiter = createRateLimitMiddleware('transcribe', 10, 60);

// GET /api/photos - List photos for the current user
app.get('/', async (c) => {
  const { userId } = c.get('auth');
  const { limit = 30, offset = 0, albumId } = c.req.query();

  let query: D1PreparedStatement;
  if (albumId) {
    query = c.env.DB.prepare(
      `SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at, GROUP_CONCAT(t.name) as tags
       FROM photos p
       JOIN album_photos ap ON p.id = ap.photo_id
       LEFT JOIN photo_tags pt ON p.id = pt.photo_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.owner_id = ? AND ap.album_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(userId, albumId, Number(limit), Number(offset));
  } else {
    query = c.env.DB.prepare(
      `SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at, GROUP_CONCAT(t.name) as tags
       FROM photos p
       LEFT JOIN photo_tags pt ON p.id = pt.photo_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.owner_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(userId, Number(limit), Number(offset));
  }

  const { results } = await query.all();
  const photos = (results || []).map(p => ({ ...p, tags: p.tags ? (p.tags as string).split(',') : [] }));

  return c.json({ photos });
});

// POST /api/photos/uploads/image - Request a presigned URL for image upload
app.use('/uploads/image', uploadsImageLimiter);
app.post('/uploads/image', zValidator('json', z.object({ filename: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const { filename } = c.req.valid('json');

    // Basic filename validation: allow common image types
    const allowed = /\.(jpg|jpeg|png|webp)$/i.test(filename);
    if (!allowed) {
      return c.json({ error: 'Unsupported image type. Allowed: jpg, jpeg, png, webp' }, 400);
    }

    const key = `photos/${userId}/${Date.now()}-${filename}`;

    const signedUrl = await c.env.PHOTOS_BUCKET.createPresignedUrl({
        key,
        action: 'put',
        expiration: 3600, // Expires in 1 hour
    });

    return c.json({ uploadUrl: signedUrl, key });
});

// POST /api/photos - Create a photo record in the DB after successful upload
app.post('/', zValidator('json', z.object({ r2Key: z.string() })), async (c) => {
  const { userId } = c.get('auth');
  const { r2Key } = c.req.valid('json');
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO photos (id, owner_id, r2_key, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, r2Key, new Date().toISOString()).run();

  return c.json({ id, message: 'Photo record created successfully' });
});

// PUT /api/photos/:photoId/caption - Update photo caption
app.put('/:photoId/caption', zValidator('json', z.object({ caption: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const photoId = c.req.param('photoId');
    const { caption } = c.req.valid('json');

    const { success } = await c.env.DB.prepare(
        'UPDATE photos SET transcription_text = ? WHERE id = ? AND owner_id = ?'
    ).bind(caption, photoId, userId).run();

    if (!success) {
        return c.json({ error: 'Failed to update caption or photo not found' }, 500);
    }
    return c.json({ success: true });
});

// POST /api/photos/:photoId/transcribe - Enqueue transcription job for an uploaded audio file
app.use('/:photoId/transcribe', transcribeLimiter);
app.post('/:photoId/transcribe', zValidator('json', z.object({toId = c.req.param('photoId');
    const { r2Key } = c.req.valid('json');

    await scheduleTranscriptionJob(c.env, r2Key, photoId);

    return c.json({ success: true, message: 'Transcription job enqueued' });
});

// DELETE /api/photos/:photoId - Delete a photo
app.delete('/:photoId', async (c) => {
    const { userId } = c.get('auth');
    const photoId = c.req.param('photoId');

    const photo = await c.env.DB.prepare(
        'SELECT r2_key FROM photos WHERE id = ? AND owner_id = ?'
    ).bind(photoId, userId).first<{ r2_key: string }>();

    if (!photo) {
        return c.json({ error: 'Photo not found' }, 404);
    }

    // Delete DB record. ON DELETE CASCADE handles related table cleanup.
    await c.env.DB.prepare(
        'DELETE FROM photos WHERE id = ? AND owner_id = ?'
    ).bind(photoId, userId).run();

    // Schedule R2 object deletion as a background job for reliability
    if (photo.r2_key) {
        await scheduleR2Delete(c.env, photo.r2_key);
    }

    return c.json({ success: true });
});

// GET /api/tags - List all tags
app.get('/tags', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT name FROM tags ORDER BY name').all();
    return c.json({ tags: results || [] });
});

// POST /api/photos/:photoId/tags - Add tags to a photo
app.post('/:photoId/tags', zValidator('json', z.object({ tags: z.array(z.string()) })), async (c) => {
    const { userId } = c.get('auth');
    const photoId = c.req.param('photoId');
    const { tags } = c.req.valid('json');

    const photo = await c.env.DB.prepare('SELECT id FROM photos WHERE id = ? AND owner_id = ?').bind(photoId, userId).first();
    if (!photo) return c.json({ error: 'Photo not found' }, 404);

    await c.env.DB.transaction(async (tx) => {
        for (const tagName of tags) {
            await tx.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').bind(tagName).run();
            const tag = await tx.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first<{ id: number }>();
            if (tag) {
                await tx.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)').bind(photoId, tag.id).run();
            }
        }
    });

    return c.json({ success: true });
});

// DELETE /api/photos/:photoId/tags - Remove tags from a photo
app.delete('/:photoId/tags', zValidator('json', z.object({ tags: z.array(z.string()) })), async (c) => {
    const { userId } = c.get('auth');
    const photoId = c.req.param('photoId');
    const { tags } = c.req.valid('json');

    const photo = await c.env.DB.prepare('SELECT id FROM photos WHERE id = ? AND owner_id = ?').bind(photoId, userId).first();
    if (!photo) return c.json({ error: 'Photo not found' }, 404);

    const placeholders = tags.map(() => '?').join(',');
    const tagIdsQuery = `SELECT id FROM tags WHERE name IN (${placeholders})`;
    const tagIdsResult = await c.env.DB.prepare(tagIdsQuery).bind(...tags).all<{ id: number }>();
    const tagIds = tagIdsResult.results.map(r => r.id);

    if (tagIds.length > 0) {
        const deletePlaceholders = tagIds.map(() => '?').join(',');
        await c.env.DB.prepare(
            `DELETE FROM photo_tags WHERE photo_id = ? AND tag_id IN (${deletePlaceholders})`
        ).bind(photoId, ...tagIds).run();
    }

    return c.json({ success: true });
});

export default app;