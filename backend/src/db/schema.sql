-- Drop tables if they exist to ensure a clean slate
DROP TABLE IF EXISTS shares;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS user_streaks;
DROP TABLE IF EXISTS album_photos;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS photo_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS audio_files;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS jobs;

-- Create Tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,    -- Clerk User ID
  email TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  alt_text TEXT,
  transcription_text TEXT, -- Stores the text from voice captions
  enhanced_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audio_files (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  transcription_text TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE photo_tags (
  photo_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (photo_id, tag_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE album_photos (
  album_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (album_id, photo_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY, -- e.g., 'FIRST_UPLOAD', 'TEN_CAPTIONS'
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

CREATE TABLE user_streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  last_activity_date TEXT NOT NULL DEFAULT (date('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'photo' or 'album'
  target_id TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'done', 'failed'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_owner_id ON photos(owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_r2_key ON photos(r2_key);
CREATE INDEX IF NOT EXISTS idx_albums_owner_id ON albums(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner_id ON shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_share_token ON shares(share_token);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_usage_user_id ON transcription_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_usage_created_at ON transcription_usage(created_at);

-- Seed initial achievements
INSERT INTO achievements (id, name, description) VALUES
('FIRST_UPLOAD', 'First Upload', 'You uploaded your first photo!'),
('FIRST_CAPTION', 'First Caption', 'You added your first voice caption.'),
('FIRST_SHARE', 'First Share', 'You shared a memory for the first time.');