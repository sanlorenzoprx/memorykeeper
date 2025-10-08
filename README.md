# Memorykeeper

Memorykeeper — a production-ready, voice-enabled photo memory vault using Next.js (frontend) and Hono on Cloudflare Workers (backend).

## Features
- Secure photo and audio uploading directly to Cloudflare R2.
- AI-powered audio transcription for voice captions (via Cloudflare AI).
- Editable captions and photo tagging.
- Album creation and organization.
- Secure photo and album sharing (with expiry and revocation).
- Gamification elements like streaks and achievements.
- Background jobs for reliable processing (R2 deletions, AI transcription) with dedup + retry/backoff.
- Admin jobs dashboard endpoints.

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

    # Apply migrations (or use the runner script)
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/000_schema_migrations.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/001_init.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/002_jobs_attempts.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/003_job_scheduling.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/004_shares_expiry.sql
    wrangler d1 execute memorykeeper-db --file=backend/src/db/migrations/005_rate_limits.sql

    # Or run the migration runner
    pnpm db:migrate
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
    ADMIN_USER_IDS="user_123,user_456" # Optional admin override
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

## Production Deploy Playbook
- **Security & Auth**
  - Restrict `/api/jobs` endpoints to admins only. Configure ADMIN_USER_IDS or use Clerk roles in JWT.
  - Lock down `CORS_ORIGINS` to your production domains.
  - Ensure wrangler secrets are set in production (`CLERK_JWKS_URI`, `CLERK_ISSUER`, optional `AI_MODEL_WHISPER`).
- **Database**
  - Run migrations on the production D1 database (use `pnpm db:migrate` or apply files in order).
  - Have a rollback plan: keep previous schema files and take snapshots or backups before applying changes.
- **Rate Limiting**
  - App-level rate limits are enabled for upload endpoints and transcription triggers.
  - Complement with Cloudflare rules to protect endpoints from abuse.
- **Sharing**
  - Shares support `expires_at` and `revoked_at`. Use `expiresAt` when creating shares and DELETE `/api/share/:token` to revoke.
- **Observability**
  - Add error tracking (e.g., Sentry) and/or Workers Analytics (optional).
  - Monitor job stats via `/api/jobs/stats`; review failures via `/api/jobs?status=failed`.
- **Testing & CI**
  - Run tests in CI (already configured); ensure green before deploy.
  - Add more negative tests as needed for your flows.
- **Frontend Auth (Server-Side)**
  - For SSR or server actions, use `apps/web/lib/api.server.ts` to call backend with server-side Clerk tokens.

## Notes
- Background jobs run via cron (see `wrangler.toml`) and process pending tasks like transcription and R2 deletions, with exponential backoff and jitter.
- Authentication is handled by Clerk. Frontend requests automatically attach the Clerk session token when available (client-side), and `api.server.ts` is available for server-side contexts.