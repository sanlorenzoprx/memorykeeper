# Memorykeeper Project Agent Instructions

## Core Architecture
- **Monorepo**: This is a pnpm workspaces monorepo. The frontend is in `apps/web`, the backend is in `backend`, and shared code is in `packages`.
- **Frontend**: A Next.js 15 application using the App Router. All components should be React functional components written in TypeScript. Styling is done with Tailwind CSS and Shadcn/UI.
- **Backend**: A Hono API running on Cloudflare Workers. It's written in TypeScript and uses Zod for validation.
- **Database**: We use Cloudflare D1. All database columns and table names must use `snake_case`.
- **Authentication**: User authentication is handled by Clerk. Backend routes are protected by a JWT verification middleware.

## Key Development Patterns
- **Data Fetching (Frontend)**: All client-side data fetching must use TanStack Query (`@tanstack/react-query`) with the helper functions in `apps/web/lib/api.ts`.
- **File Uploads (R2)**: We use a **presigned URL** strategy for all file uploads (images and audio). The flow is: client requests URL from backend -> client PUTs file to R2 -> client notifies backend of completion.
- **State Management**: Prefer server-state management with TanStack Query. For client-side state, use React's built-in hooks (`useState`, `useContext`).
- **Types**: All shared types between the frontend and backend must be defined in the `@memorykeeper/types` package to ensure consistency.