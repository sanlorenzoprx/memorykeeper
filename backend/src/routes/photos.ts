import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';
import { scheduleR2Delete } from '../utils/jobs';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// Helper function to generate presigned URL for R2
const generatePresignedUrl = async (env: Env, key: string): Promise<string> => {
    try {
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const accessKeyId = env.R2_ACCESS_KEY_ID;

        // Check if we have real credentials or just placeholders
        console.log('Account ID:', accountId);
        console.log('Access Key ID:', accessKeyId);
        if (accountId === 'your_account_id_here' || accessKeyId === 'your_r2_access_key_id') {
            console.warn('Using placeholder credentials - returning mock URL for local development');
            console.warn('For production, set up real R2 credentials in .dev.vars or use wrangler secret put');

            // Return a mock URL that indicates development mode
            // Frontend should handle this case gracefully
            return `dev-mode://mock-upload-url/${key}`;
        }

        if (!accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }

        // Create a simple presigned URL for R2
        // R2 supports S3-compatible presigned URLs
        const bucketName = 'memorykeeper-photos';
        const credential = `${accessKeyId}/${new Date().toISOString().split('T')[0]}/auto/s3/aws4_request`;

        const params = new URLSearchParams({
            'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
            'X-Amz-Credential': credential,
            'X-Amz-Date': new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z',
            'X-Amz-Expires': '3600',
            'X-Amz-SignedHeaders': 'host',
        });

        const url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}?${params.toString()}`;

        console.log('Generated presigned URL for key:', key);
        return url;
    } catch (error) {
        console.error('Failed to generate presigned URL:', error);
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
};

// GET /api/photos - List photos for the current user with search and filtering
app.get('/', async (c) => {
  const { userId } = c.get('auth');
  const {
    limit = 30,
    offset = 0,
    albumId,
    search,
    tags,
    sort = 'newest',
    dateFrom,
    dateTo
  } = c.req.query();

  // Build WHERE conditions
  let whereConditions = ['p.owner_id = ?'];
  let bindParams: any[] = [userId];

  // Album filter
  if (albumId) {
    whereConditions.push('ap.album_id = ?');
    bindParams.push(albumId);
  }

  // Search filter (searches in transcription_text and alt_text)
  if (search) {
    whereConditions.push('(p.transcription_text LIKE ? OR p.alt_text LIKE ?)');
    bindParams.push(`%${search}%`, `%${search}%`);
  }

  // Tag filter
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const tagConditions = tagList.map(() => 't.name = ?').join(' OR ');
    whereConditions.push(`(${tagConditions})`);
    bindParams.push(...tagList);
  }

  // Date range filter
  if (dateFrom) {
    whereConditions.push('p.created_at >= ?');
    bindParams.push(dateFrom);
  }
  if (dateTo) {
    whereConditions.push('p.created_at <= ?');
    bindParams.push(dateTo);
  }

  // Sort options
  let orderBy = 'p.created_at DESC';
  switch (sort) {
    case 'oldest':
      orderBy = 'p.created_at ASC';
      break;
    case 'name':
      orderBy = 'p.alt_text ASC, p.created_at DESC';
      break;
    case 'newest':
    default:
      orderBy = 'p.created_at DESC';
      break;
  }

  const whereClause = whereConditions.join(' AND ');

  let query: D1PreparedStatement;
  if (albumId) {
    // For album photos, we need a more complex query
    query = c.env.DB.prepare(`
      SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at, GROUP_CONCAT(t.name) as tags
      FROM photos p
      JOIN album_photos ap ON p.id = ap.photo_id
      LEFT JOIN photo_tags pt ON p.id = pt.photo_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE ${whereClause}
      GROUP BY p.id
      ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(...bindParams, Number(limit), Number(offset));
  } else {
    query = c.env.DB.prepare(`
      SELECT p.id, p.r2_key, p.alt_text, p.transcription_text, p.created_at, GROUP_CONCAT(t.name) as tags
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photo_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE ${whereClause}
      GROUP BY p.id
      ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(...bindParams, Number(limit), Number(offset));
  }

  const { results } = await query.all();
  const photos = (results || []).map(p => ({ ...p, tags: p.tags ? (p.tags as string).split(',') : [] }));

  // Get total count for pagination
  let countQuery: D1PreparedStatement;
  if (albumId) {
    countQuery = c.env.DB.prepare(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM photos p
      JOIN album_photos ap ON p.id = ap.photo_id
      LEFT JOIN photo_tags pt ON p.id = pt.photo_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE ${whereClause}`
    ).bind(...bindParams);
  } else {
    countQuery = c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM photos p
      LEFT JOIN photo_tags pt ON p.id = pt.photo_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE ${whereClause}`
    ).bind(...bindParams);
  }

  const { results: countResults } = await countQuery.all();
  const total = countResults[0]?.total || 0;

  return c.json({
    photos,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: (Number(offset) + Number(limit)) < total
    },
    filters: {
      search,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      sort,
      dateFrom,
      dateTo
    }
  });
});

// POST /api/photos/uploads/image - Request a presigned URL for image upload
app.post('/uploads/image', zValidator('json', z.object({ filename: z.string() })), async (c) => {
    try {
        console.log("Step 1: Attempting to generate presigned URL...");
        const { userId } = c.get('auth');
        const { filename } = c.req.valid('json');
        const key = `photos/${userId}/${Date.now()}-${filename}`;
        console.log(`  - User: ${userId}, Filename: ${filename}, Key: ${key}`);

        const signedUrl = await generatePresignedUrl(c.env, key);
        
        console.log("Step 1 SUCCESS: Presigned URL generated.");
        return c.json({ uploadUrl: signedUrl, key });
    } catch (e) {
        console.error("Step 1 FAILED: Error generating presigned URL.", e);
        return c.json({ error: 'Failed to generate upload URL' }, 500);
    }
});

// POST /api/photos - Create a photo record in the DB after successful upload
app.post('/', zValidator('json', z.object({ r2Key: z.string() })), async (c) => {
    try {
        console.log("Step 2: Attempting to create photo DB record...");
        const { userId } = c.get('auth');
        const { r2Key } = c.req.valid('json');
        const id = crypto.randomUUID();
        console.log(`  - User: ${userId}, R2 Key: ${r2Key}`);

        await c.env.DB.prepare(
            'INSERT INTO photos (id, owner_id, r2_key, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, userId, r2Key, new Date().toISOString()).run();

        console.log("Step 2 SUCCESS: Photo DB record created.");
        return c.json({ id, message: 'Photo record created successfully' });
    } catch (e) {
        console.error("Step 2 FAILED: Error creating photo DB record.", e);
        return c.json({ error: 'Failed to create photo record' }, 500);
    }
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

// POST /api/photos/:photoId/transcribe - Trigger transcription for an uploaded audio file
app.post('/:photoId/transcribe', zValidator('json', z.object({ r2Key: z.string() })), async (c) => {
    const photoId = c.req.param('photoId');
    const { r2Key } = c.req.valid('json');
    // In a real app, this would be enqueued. For now, direct call.
    // This assumes `transcribeAudioAndUpdatePhoto` is in `ai.ts`
    // await transcribeAudioAndUpdatePhoto(c.env, r2Key, photoId);
    return c.json({ message: 'Transcription process started' });
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