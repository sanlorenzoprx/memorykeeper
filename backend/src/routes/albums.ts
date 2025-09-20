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

// POST /api/albums - Create a new album  
app.post('/', zValidator('json', z.object({ name: z.string(), description: z.string().optional() })), async (c) => {  
  const { userId } = c.get('auth');  
  const { name, description } = c.req.valid('json');  
  const id = crypto.randomUUID();  
    
  await c.env.DB.prepare(  
    'INSERT INTO albums (id, owner_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'  
  ).bind(id, userId, name, description || '', new Date().toISOString()).run();

  return c.json({ id, message: 'Album created successfully' });  
});

export default app;
