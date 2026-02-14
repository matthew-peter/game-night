-- ============================================================================
-- Migration 009: Fix constraints for multi-game platform
--
-- The original schema only allows 'clue' and 'guess' for current_phase.
-- Scrabble uses 'play'. This migration fixes that.
--
-- Also drops the old move_type constraint if it still exists (belt and
-- suspenders — 007 should have handled it, but let's be safe).
-- ============================================================================

-- ── 1. Fix current_phase constraint ─────────────────────────────────────────

-- Drop the old constraint (allows only 'clue', 'guess')
DO $$
BEGIN
  ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_current_phase_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add the new constraint that includes 'play' for Scrabble
ALTER TABLE public.games
  ADD CONSTRAINT games_current_phase_check
  CHECK (current_phase IN ('clue', 'guess', 'play'));


-- ── 2. Ensure move_type constraint is gone (flexible for all game types) ────

DO $$
BEGIN
  ALTER TABLE public.moves DROP CONSTRAINT IF EXISTS moves_move_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
