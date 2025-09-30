-- Database indexes for improved query performance
-- These indexes should be added to improve the performance of common queries

-- Index for photos by owner_id (most common filter)
CREATE INDEX IF NOT EXISTS idx_photos_owner_id ON photos(owner_id);

-- Index for photos by created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);

-- Index for photos by owner_id and created_at (combined for better performance)
CREATE INDEX IF NOT EXISTS idx_photos_owner_created ON photos(owner_id, created_at);

-- Index for album_photos by album_id (for album queries)
CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);

-- Index for album_photos by photo_id (for photo album lookups)
CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);

-- Index for photo_tags by photo_id (for tag queries)
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);

-- Index for photo_tags by tag_id (for reverse tag lookups)
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);

-- Index for tags by name (for tag searches)
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Index for albums by owner_id (for user album queries)
CREATE INDEX IF NOT EXISTS idx_albums_owner_id ON albums(owner_id);

-- Index for user_achievements by user_id (for gamification queries)
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- Index for user_streaks by user_id (for streak queries)
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);

-- Index for shares by owner_id (for user share queries)
CREATE INDEX IF NOT EXISTS idx_shares_owner_id ON shares(owner_id);

-- Index for shares by share_token (for share lookups)
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
