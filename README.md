# Memorykeeper

[![CI](https://github.com/sanlorenzoprx/memorykeeper/actions/workflows/ci.yml/badge.svg)](https://github.com/sanlorenzoprx/memorykeeper/actions/workflows/ci.yml)

Memorykeeper — a production-ready, voice-enabled photo memory vault using Next.js (frontend) and Hono on Cloudflare Workers (backend).

## Features
- Secure photo and audio uploading directly to Cloudflare R2.
- AI-powered audio transcription for voice captions (via Cloudflare AI).
- Editable captions and photo tagging.
- Album creation and organization.
- Secure photo and album sharing.
- Gamification elements like streaks and achievements.

## Quickstart (Local Development)
1.  **Clone the repository.**
2.  **Setup Environment Variables**: Create a `.dev.vars` file in the `backend` directory and fill in the required keys for Clerk and Cloudflare. Create a `.env.local` in the `apps/web` directory for frontend variables.
3.  **Install Dependencies**:
    ```bash
    # Install pnpm if you haven't already
    npm install -g pnpm

    # Install dependencies for all workspaces
    pnpm install
    ```
4.  **Run Development Servers**:
    ```bash
    # This will start both the backend (Hono/Wrangler) and frontend (Next.js) concurrently
    pnpm dev:all
    ```
5.  Open your browser to the Next.js development server URL (usually `http://localhost:3000`).