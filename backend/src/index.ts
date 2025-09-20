import { Hono } from 'hono';  
import { cors } from 'hono/cors';  
import { authMiddleware } from './middleware/auth';  
import photos from './routes/photos';  
import audio from './routes/audio';  
import albums from './routes/albums';  
import share from './routes/share';

const app = new Hono();

// Apply CORS middleware to all routes  
app.use('*', cors({  
  origin: ['http://localhost:3000'], // Add your production frontend URL here  
  credentials: true,  
}));

// Public share route - does not require authentication  
app.route('/share', share);

// Apply auth middleware to all /api routes  
app.use('/api/*', authMiddleware);

// Authenticated API routes  
app.route('/api/photos', photos);  
app.route('/api/audio', audio);  
app.route('/api/albums', albums);

export default app;
