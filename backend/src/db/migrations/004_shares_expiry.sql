BEGIN TRANSACTION;

-- Add expiry and revocation columns to shares
ALTER TABLE shares ADD COLUMN expires_at TEXT;
ALTER TABLE shares ADD COLUMN revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);

COMMIT;