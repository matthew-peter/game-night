-- ============================================================================
-- Migration 015: Add So Clover game support
--
-- So Clover uses 'clue_writing' and 'resolution' as current_phase values.
-- Update the CHECK constraint to allow them.
-- ============================================================================

-- Drop the old constraint
DO $$
BEGIN
  ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_current_phase_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add the updated constraint with So Clover phases
ALTER TABLE public.games
  ADD CONSTRAINT games_current_phase_check
  CHECK (current_phase IN ('clue', 'guess', 'play', 'clue_writing', 'resolution'));
