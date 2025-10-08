BEGIN TRANSACTION;

-- Add scheduling metadata columns to jobs
ALTER TABLE jobs ADD COLUMN next_run_at TEXT;
ALTER TABLE jobs ADD COLUMN max_attempts INTEGER DEFAULT 3;

-- Index to accelerate picking due jobs
CREATE INDEX IF NOT EXISTS idx_jobs_pending_next_run
ON jobs(status, next_run_at);

COMMIT;