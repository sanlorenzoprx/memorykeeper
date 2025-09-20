import { Hono } from 'hono';  
import { z } from 'zod';  
import { zValidator } from '@hono/zod-validator';  
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// GET /api/photos - List photos for the current user  
app.get('/', async (c) => {  
  const { userId } = c.get('auth');  
  const { limit = 30, offset = 0 } = c.req.query();

  const res = await c.env.DB.prepare(  
    'SELECT id, r2_key, alt_text, transcription_text, created_at FROM photos WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'  
  ).bind(userId, Number(limit), Number(offset)).all();  
    
  return c.json({ photos: res.results || [] });  
});

// POST /api/photos/uploads/image - Request a presigned URL for image upload  
app.post('/uploads/image', zValidator('json', z.object({ filename: z.string() })), async (c) => {  
    const { userId } = c.get('auth');  
    const { filename } = c.req.valid('json');  
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

// POST /api/photos/:photoId/transcribe - Trigger transcription for an uploaded audio file  
app.post('/:photoId/transcribe', zValidator('json', z.object({ r2Key: z.string() })), async (c) => {  
    const photoId = c.req.param('photoId');  
    const { r2Key } = c.req.valid('json');  
    // In a real app, you would add this to a queue  
    // For now, we process it directly  
    // This assumes `transcribeAudio` is a function in `ai.ts`  
    // const transcription = await transcribeAudio(c.env, r2Key, photoId);  
    return c.json({ message: 'Transcription process started' });  
});

// DELETE /api/photos/:photoId - Delete a photo  
app.delete('/:photoId', async (c) => {  
    const { userId } = c.get('auth');  
    const photoId = c.req.param('photoId');

    // First, get the r2_key to delete the object from R2  
    const photo = await c.env.DB.prepare(  
        'SELECT r2_key FROM photos WHERE id = ? AND owner_id = ?'  
    ).bind(photoId, userId).first<{ r2_key: string }>();

    if (photo?.r2_key) {  
        await c.env.PHOTOS_BUCKET.delete(photo.r2_key);  
    }  
      
    // Then delete the record from D1 (cascades should handle related data)  
    await c.env.DB.prepare(  
        'DELETE FROM photos WHERE id = ? AND owner_id = ?'  
    ).bind(photoId, userId).run();

    return c.json({ success: true });  
});

export default app;
