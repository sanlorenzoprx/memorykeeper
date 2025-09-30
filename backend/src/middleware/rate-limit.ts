import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (c: any) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Whether to count successful requests
  skipFailedRequests?: boolean; // Whether to count failed requests
}

interface RateLimitInfo {
  totalRequests: number;
  resetTime: number;
  remainingRequests: number;
}

const defaultKeyGenerator = (c: any) => {
  // Use IP address for rate limiting (in Cloudflare Workers, this would be c.req.header('CF-Connecting-IP'))
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  return `rate_limit:${ip}`;
};

// In-memory store for rate limiting (in production, use KV or Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getRateLimitInfo(key: string, windowMs: number): RateLimitInfo {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      totalRequests: 1,
      resetTime,
      remainingRequests: 0, // Will be calculated below
    };
  }

  const remaining = Math.max(0, 1 - entry.count); // 1 because we just incremented
  return {
    totalRequests: entry.count + 1,
    resetTime: entry.resetTime,
    remainingRequests: remaining,
  };
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const key = config.keyGenerator ? config.keyGenerator(c) : defaultKeyGenerator(c);

    const rateLimitInfo = getRateLimitInfo(key, config.windowMs);
    const isRateLimited = rateLimitInfo.totalRequests > config.maxRequests;

    // Add rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - rateLimitInfo.totalRequests).toString());
    c.header('X-RateLimit-Reset', Math.floor(rateLimitInfo.resetTime / 1000).toString());

    if (isRateLimited) {
      return c.json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)} seconds.`,
        retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
      }, 429);
    }

    // Update the rate limit counter
    const entry = rateLimitStore.get(key);
    if (entry) {
      entry.count = rateLimitInfo.totalRequests;
    }

    // Clean up expired entries periodically (simple cleanup every 100 requests)
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [k, v] of rateLimitStore.entries()) {
        if (now > v.resetTime) {
          rateLimitStore.delete(k);
        }
      }
    }

    await next();
  });
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Strict rate limiting for uploads (to prevent storage abuse)
  upload: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    keyGenerator: (c) => {
      const userId = c.get('auth')?.userId || 'anonymous';
      return `upload:${userId}`;
    },
  }),

  // Moderate rate limiting for API endpoints
  api: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    keyGenerator: (c) => {
      const userId = c.get('auth')?.userId || 'anonymous';
      return `api:${userId}`;
    },
  }),

  // Loose rate limiting for public endpoints
  public: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute
    keyGenerator: defaultKeyGenerator,
  }),

  // Very strict rate limiting for authentication endpoints
  auth: createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 auth attempts per 15 minutes
    keyGenerator: defaultKeyGenerator,
  }),
};
