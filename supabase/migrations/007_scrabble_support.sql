-- ============================================================================
-- Migration 007: Scrabble support
--
-- Adds:
-- - move_data JSONB column to moves table for game-specific move data
-- - Updates move_type check to include Scrabble move types
-- ============================================================================

-- Add move_data column for game-specific move details (Scrabble placements, etc.)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS move_data JSONB DEFAULT NULL;

-- If there's a CHECK constraint on move_type, drop and recreate it
-- (Supabase may or may not have one depending on how schema.sql was set up)
DO $$
BEGIN
  -- Try to drop existing constraint
  ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_move_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Note: We intentionally do NOT add a CHECK constraint on move_type
-- to keep it flexible for future game types. The application layer validates.
