CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL
);
