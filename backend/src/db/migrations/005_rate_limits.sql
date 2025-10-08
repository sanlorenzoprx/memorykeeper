BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,
  route_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route_key, window_start)
);

COMMIT;