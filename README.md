# Memorykeeper

Memorykeeper — a production-ready, voice-enabled photo memory vault using Next.js (frontend) and Hono on Cloudflare Workers (backend).

## Features
- Secure photo and audio uploading directly to Cloudflare R2.
- AI-powered audio transcription for voice captions (via Cloudflare AI).
- Editable captions and photo tagging.
- Album creation and organization.
- Secure photo and album sharing.
- Gamification elements like streaks and achievements.
- Background jobs for reliable processing (R2 deletions, AI transcription).

## Quickstart (Local Development)
1.  **Clone the repository.**
2.  **Install Dependencies**:
    ```bash
    # Install pnpm if you haven't already
    npm install -g pnpm
    pnpm install
    ```
3.  **Cloudflare D1 (Database) — Create and migrate (dev)**:
    ```bash
    # Create a dev D1 database
    wrangler d1 create memorykeeper-db

    # Apply initial schema and job enhancements
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/001_init.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/002_jobs_attempts.sql
    ```
4.  **Cloudflare Secrets & Vars (Backend)**:
    ```bash
    # Set secrets (production via wrangler; dev via backend/.dev.vars)
    wrangler secret put CLERK_JWKS_URI
    wrangler secret put CLERK_ISSUER

    # Optional model override
    wrangler secret put AI_MODEL_WHISPER
    ```

    For local development, create `backend/.dev.vars`:
    ```
    CLERK_JWKS_URI="https://YOUR-CLERK-DOMAIN/.well-known/jwks.json"
    CLERK_ISSUER="https://YOUR-CLERK-DOMAIN"
    AI_MODEL_WHISPER="@cf/openai/whisper"
    CORS_ORIGINS="http://localhost:3000,http://localhost:3002"
    ```

5.  **R2 Bucket (Photos & Audio)**:
    - Create a bucket named `memorykeeper-photos` and bind it in `wrangler.toml` as `PHOTOS_BUCKET`.
    - Configure a public domain (custom hostname) for serving images and set in frontend `.env.local` as `NEXT_PUBLIC_R2_PUBLIC_DOMAIN`.

6.  **Frontend Environment (.env.local)**:
    ```
    NEXT_PUBLIC_API_BASE_URL="http://localhost:8787"
    NEXT_PUBLIC_R2_PUBLIC_DOMAIN="your-r2-public-domain.example.com"
    ```

7.  **Run Development Servers**:
    ```bash
    # Start both backend (Workers) and frontend (Next.js)
    pnpm dev:all
    ```

8.  Open your browser to `http://localhost:3000`.

## Notes
- CORS origins are controlled via the `CORS_ORIGINS` environment variable (comma-separated).
- Background jobs run via cron (see `wrangler.toml`) and process pending tasks like transcription and R2 deletions.
- Authentication is handled by Clerk. Frontend requests automatically attach the Clerk session token when available.