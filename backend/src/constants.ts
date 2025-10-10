// Plan limits (in seconds)
export const PLAN_LIMITS = {
  FREE: 30 * 60, // 30 minutes
  PRO: 5 * 60 * 60, // 5 hours
} as const;

// Job processing
export const JOB_BATCH_SIZE = 20;

// Audio processing
export const DEFAULT_AUDIO_DURATION = 25; // seconds - estimated for free users

// R2 presigned URL expiration (in seconds)
export const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;
