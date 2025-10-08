-- Add retry-related fields to jobs
ALTER TABLE jobs ADD COLUMN attempts INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN last_error TEXT;

-- Optional: dedup index for pending transcribe jobs
-- (Only one pending transcribe job per unique payload)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_transcribe_jobs
ON jobs(kind, payload)
WHERE kind = 'transcribe' AND status = 'pending';