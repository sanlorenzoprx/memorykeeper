import { createMiddleware } from 'hono/factory';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env } from '../env';

type AuthEnv = {
    Variables: {
        auth: {
            userId: string;
        }
    },
    Bindings: Env;
}

// Cache the JWKSet function at module scope so it is reused across invocations
let jwksFetcher: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksFetcher(jwksUri: string) {
  if (!jwksFetcher) {
    jwksFetcher = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwksFetcher;
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const jwksUri = c.env.CLERK_JWKS_URI;
    const issuer = c.env.CLERK_ISSUER;

    // For local development, allow bypassing auth with a simple header
    const isDevMode = c.env.CLERK_JWKS_URI === 'dev-mode' || !jwksUri || !issuer;

    if (isDevMode) {
        // Development mode: Accept a simple user ID header or use a default
        const devUserId = c.req.header('X-Dev-User-Id') || 'dev-user-123';

        console.log(`Development mode: Using user ID: ${devUserId}`);

        // Upsert user into the D1 database for development
        try {
            await c.env.DB.prepare(
                'INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO NOTHING'
            ).bind(devUserId, 'dev@example.com').run();
        } catch (dbError) {
            console.error("Database error during dev user upsert:", dbError);
            // Don't fail the request for dev mode user creation issues
        }

        // Set the userId in the context for downstream routes
        c.set('auth', { userId: devUserId });
        await next();
        return;
    }

    // Production mode: Verify JWT token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    if (!jwksUri || !issuer) {
        console.error("Clerk JWKS URI or Issuer not configured in environment.");
        return c.json({ error: 'Internal Server Error: Auth not configured' }, 500);
    }

    const token = authHeader.substring(7);
    const JWKS = getJwksFetcher(jwksUri);

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: issuer,
            algorithms: ['RS256'],
        });

        const userId = payload.sub;
        if (!userId) {
            return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
        }

        // Upsert user into the D1 database
        try {
            await c.env.DB.prepare(
                'INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO NOTHING'
            ).bind(userId, payload.email || '').run();
        } catch (dbError) {
            console.error("Database error during user upsert:", dbError);
            return c.json({ error: 'Internal Server Error: Could not process user' }, 500);
        }

        // Set the userId in the context for downstream routes
        c.set('auth', { userId });
        await next();

    } catch (err) {
        console.error("Token verification failed:", err);
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
});