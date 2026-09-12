CREATE TABLE IF NOT EXISTS access_visits (
  visit_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT NOT NULL,
  country TEXT,
  colo TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  browser TEXT NOT NULL DEFAULT 'unknown',
  referrer TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '/',
  language TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_access_visits_last_seen ON access_visits (last_seen_at);
