import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// GET /api/albums - List albums for the current user
app.get('/', async (c) => {
  const { userId } = c.get('auth');

  const res = await c.env.DB.prepare(
    'SELECT id, name, description, created_at FROM albums WHERE owner_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return c.json({ albums: res.results || [] });
});

// GET /api/albums/:id - Get single album
app.get('/:id', async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');

    const album = await c.env.DB.prepare(
        'SELECT id, name, description, created_at FROM albums WHERE id = ? AND owner_id = ?'
    ).bind(id, userId).first();

    if (!album) return c.json({ error: 'Album not found' }, 404);
    return c.json({ album });
});

// POST /api/albums - Create a new album
app.post('/', zValidator('json', z.object({ name: z.string().min(1), description: z.string().optional() })), async (c) => {
  const { userId } = c.get('auth');
  const { name, description } = c.req.valid('json');
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO albums (id, owner_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, name, description || '', new Date().toISOString()).run();

  return c.json({ id, message: 'Album created successfully' });
});

// PUT /api/albums/:id - Update an album
app.put('/:id', zValidator('json', z.object({ name: z.string().min(1), description: z.string().optional() })), async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const { name, description } = c.req.valid('json');

    const { success } = await c.env.DB.prepare(
        'UPDATE albums SET name = ?, description = ? WHERE id = ? AND owner_id = ?'
    ).bind(name, description || '', id, userId).run();

    if (!success) return c.json({ error: 'Failed to update album or album not found' }, 500);
    return c.json({ success: true });
});

// DELETE /api/albums/:id - Delete an album
app.delete('/:id', async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');

    await c.env.DB.prepare(
        'DELETE FROM albums WHERE id = ? AND owner_id = ?'
    ).bind(id, userId).run();

    return c.json({ success: true });
});

// POST /api/albums/:id/photos - Add a photo to an album
app.post('/:id/photos', zValidator('json', z.object({ photoId: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const albumId = c.req.param('id');
    const { photoId } = c.req.valid('json');

    // Verify ownership of both album and photo
    const album = await c.env.DB.prepare('SELECT id FROM albums WHERE id = ? AND owner_id = ?').bind(albumId, userId).first();
    if (!album) return c.json({ error: 'Album not found' }, 404);

    const photo = await c.env.DB.prepare('SELECT id FROM photos WHERE id = ? AND owner_id = ?').bind(photoId, userId).first();
    if (!photo) return c.json({ error: 'Photo not found' }, 404);

    await c.env.DB.prepare(
        'INSERT OR IGNORE INTO album_photos (album_id, photo_id) VALUES (?, ?)'
    ).bind(albumId, photoId).run();

    return c.json({ success: true });
});

// DELETE /api/albums/:id/photos/:photoId - Remove a photo from an album
app.delete('/:id/photos/:photoId', async (c) => {
    const { userId } = c.get('auth');
    const albumId = c.req.param('id');
    const photoId = c.req.param('photoId');

    // Verify ownership of album to ensure user can perform this action
    const album = await c.env.DB.prepare('SELECT id FROM albums WHERE id = ? AND owner_id = ?').bind(albumId, userId).first();
    if (!album) return c.json({ error: 'Album not found' }, 404);

    await c.env.DB.prepare(
        'DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?'
    ).bind(albumId, photoId).run();

    return c.json({ success: true });
});

export default app;