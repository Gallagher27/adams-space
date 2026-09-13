CREATE TABLE IF NOT EXISTS timeline_assets (
  id TEXT PRIMARY KEY,
  timeline_id TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'document',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_assets_timeline ON timeline_assets (timeline_id, position);
