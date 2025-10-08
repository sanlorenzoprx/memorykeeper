import { createMiddleware } from 'hono/factory';
import { jwtVerify, createRemoteJWKSet } from 'jose';

type AuthEnv = {
    Variables: {
        auth: {
            userId: string;
            isAdmin?: boolean;
        }
    },
    Bindings: {
        CLERK_JWKS_URI: string;
        CLERK_ISSUER: string;
        ADMIN_USER_IDS?: string;
    }
}

// Cache the JWKSet function at module scope so it is reused across invocations
let jwksFetcher: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksFetcher(jwksUri: string) {
  if (!jwksFetcher) {
    jwksFetcher = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwksFetcher;
}

function computeIsAdmin(userId: string, payload: Record<string, any>, envAdminList: string | undefined): boolean {
  const envAdmins = (envAdminList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envAdmins.includes(userId)) return true;

  const roles: string[] = Array.isArray(payload['roles'])
    ? payload['roles']
    : Array.isArray(payload['organization_roles'])
      ? payload['organization_roles']
      : [];

  const role = payload['role'] || payload['org_role'] || payload['public_metadata']?.role;
  return roles.includes('admin') || role === 'admin';
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

    const JWKS = getJwksFetcher(jwksUri);

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: issuer,
            algorithms: ['RS256'],
        });

        const userId = payload.sub as string | undefined;
        if (!userId) {
            return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
        }

        const isAdmin = computeIsAdmin(userId, payload as any, c.env.ADMIN_USER_IDS);

        // Set the userId and isAdmin flag in the context for downstream routes
        c.set('auth', { userId, isAdmin });
        await next();

    } catch (err) {
        console.error("Token verification failed:", err);
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
});