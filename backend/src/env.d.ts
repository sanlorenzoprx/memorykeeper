// This ensures TypeScript knows about the bindings defined in wrangler.toml
export interface Env {
    DB: D1Database;
    PHOTOS_BUCKET: R2Bucket;
    AI: any; // The AI binding

    // Secrets (set via `wrangler secret put` or in .dev.vars for local)
    CLERK_JWKS_URI: string;
    CLERK_ISSUER: string;
    AI_MODEL_WHISPER?: string;

    // Non-secret configuration
    CORS_ORIGINS?: string; // Comma-separated list of allowed origins
}