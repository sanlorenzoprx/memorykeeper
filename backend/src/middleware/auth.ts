import { createMiddleware } from 'hono/factory';  
import { jwtVerify, createRemoteJWKSet } from 'jose';

type AuthEnv = {  
    Variables: {  
        auth: {  
            userId: string;  
        }  
    },  
    Bindings: {  
        CLERK_JWKS_URI: string;  
        CLERK_ISSUER: string;  
    }  
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {  
    const authHeader = c.req.header('Authorization');  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {  
        return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);  
    }

    const token = authHeader.substring(7);  
    const jwksUri = c.env.CLERK_JWKS_URI;  
    const issuer = c.env.CLERK_ISSUER;

    if (!jwksUri || !issuer) {  
        console.error("Clerk JWKS URI or Issuer not configured in environment.");  
        return c.json({ error: 'Internal Server Error: Auth not configured' }, 500);  
    }

    const JWKS = createRemoteJWKSet(new URL(jwksUri));

    try {  
        const { payload } = await jwtVerify(token, JWKS, {  
            issuer: issuer,  
            algorithms: ['RS256'],  
        });

        const userId = payload.sub;  
        if (!userId) {  
            return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);  
        }

        // Set the userId in the context for downstream routes  
        c.set('auth', { userId });  
        await next();

    } catch (err) {  
        console.error("Token verification failed:", err);  
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);  
    }  
});
