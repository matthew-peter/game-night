-- ============================================================================
-- Migration 008: Ensure all user RLS policies exist
--
-- The migration 006 partial failure may have dropped policies without
-- recreating them. This script idempotently ensures all required policies
-- are in place.
-- ============================================================================

-- Drop and recreate ALL user policies to ensure clean state
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view other users in their games" ON public.users;

-- Users can always read their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can create their own profile on signup
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Users can see other users who are in the same game
CREATE POLICY "Users can view other users in their games"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp1
      JOIN public.game_players gp2 ON gp1.game_id = gp2.game_id
      WHERE gp1.user_id = auth.uid()
        AND gp2.user_id = users.id
    )
  );

-- Also ensure game_players has proper grants
GRANT ALL ON public.game_players TO authenticated;
GRANT ALL ON public.game_players TO anon;
