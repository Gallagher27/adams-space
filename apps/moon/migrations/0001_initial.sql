CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS timeline_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL, kind TEXT NOT NULL, asset_key TEXT, asset_url TEXT, file_name TEXT, mime_type TEXT, system INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blessings (id TEXT PRIMARY KEY, name TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', audio_key TEXT, created_at TEXT NOT NULL, ip_hash TEXT, owner_token_hash TEXT);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, ip_hash TEXT, user_agent_hash TEXT, created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred_at ON timeline_items (occurred_at);
CREATE INDEX IF NOT EXISTS idx_blessings_created_at ON blessings (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);
