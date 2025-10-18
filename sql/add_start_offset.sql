-- Adds a start_offset_sec column to ai_settings to avoid start-time edit locks
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS start_offset_sec integer NOT NULL DEFAULT 15;

-- Keep existing row consistent
UPDATE ai_settings SET start_offset_sec = COALESCE(start_offset_sec, 15) WHERE id = 1;
