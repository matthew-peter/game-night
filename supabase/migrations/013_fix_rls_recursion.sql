-- ============================================================================
-- Migration 013: Fix infinite recursion in game_players RLS policy
--
-- ROOT CAUSE: The game_players SELECT policy references game_players itself:
--
--   USING (EXISTS (SELECT 1 FROM game_players gp2 WHERE gp2.game_id = ...))
--
-- When Postgres evaluates that inner SELECT, it applies the same policy again,
-- which does another SELECT, which applies the policy again → infinite loop.
--
-- Every other table's policy that does EXISTS(... FROM game_players ...) also
-- triggers this recursion.
--
-- FIX: Create a SECURITY DEFINER function that checks game membership WITHOUT
-- triggering RLS. Use it everywhere.
-- ============================================================================

-- ── 1. Create the helper function ───────────────────────────────────────────
-- SECURITY DEFINER = runs as the function owner (postgres), bypassing RLS.
-- STABLE = doesn't modify data, safe to cache within a statement.

CREATE OR REPLACE FUNCTION public.is_player_in_game(p_game_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_id = p_game_id
      AND user_id = auth.uid()
  );
$$;

-- Grant execute to the roles that need it
GRANT EXECUTE ON FUNCTION public.is_player_in_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_player_in_game(UUID) TO anon;


-- ── 2. Fix game_players policies ────────────────────────────────────────────

DROP POLICY IF EXISTS "Players can view game_players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can view game_players" ON public.game_players;

-- Now uses the SECURITY DEFINER function → no recursion
CREATE POLICY "Players can view game_players in their games"
  ON public.game_players FOR SELECT
  USING (public.is_player_in_game(game_id));

-- INSERT and DELETE don't self-reference, but restate them for completeness
DROP POLICY IF EXISTS "Players can join games" ON public.game_players;
CREATE POLICY "Players can join games"
  ON public.game_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Players can leave games" ON public.game_players;
CREATE POLICY "Players can leave games"
  ON public.game_players FOR DELETE
  USING (auth.uid() = user_id);


-- ── 3. Fix games policies ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Players can view their own games" ON public.games;
DROP POLICY IF EXISTS "Players can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view waiting games by PIN" ON public.games;

CREATE POLICY "Players can view games"
  ON public.games FOR SELECT
  USING (
    status = 'waiting'
    OR public.is_player_in_game(id)
  );

-- INSERT: no game_players reference, just needs auth
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Players can update their games" ON public.games;
CREATE POLICY "Players can update their games"
  ON public.games FOR UPDATE
  USING (
    public.is_player_in_game(id)
    OR status = 'waiting'
  );

DROP POLICY IF EXISTS "Players can delete their own games" ON public.games;
CREATE POLICY "Players can delete their own games"
  ON public.games FOR DELETE
  USING (public.is_player_in_game(id));


-- ── 4. Fix moves policies ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Players can view moves in their games" ON public.moves;
CREATE POLICY "Players can view moves in their games"
  ON public.moves FOR SELECT
  USING (public.is_player_in_game(game_id));

DROP POLICY IF EXISTS "Players can insert moves in their games" ON public.moves;
CREATE POLICY "Players can insert moves in their games"
  ON public.moves FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND public.is_player_in_game(game_id)
  );

DROP POLICY IF EXISTS "Players can delete moves in their games" ON public.moves;
CREATE POLICY "Players can delete moves in their games"
  ON public.moves FOR DELETE
  USING (public.is_player_in_game(game_id));


-- ── 5. Fix chat_messages policies (defensive — table may not exist) ─────────

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Players can view chat messages in their games" ON public.chat_messages';
  EXECUTE 'CREATE POLICY "Players can view chat messages in their games"
    ON public.chat_messages FOR SELECT
    USING (public.is_player_in_game(game_id))';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Players can insert chat messages in their games" ON public.chat_messages';
  EXECUTE 'CREATE POLICY "Players can insert chat messages in their games"
    ON public.chat_messages FOR INSERT
    WITH CHECK (auth.uid() = player_id AND public.is_player_in_game(game_id))';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ── 6. Fix users policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view other users in their games" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Own profile: always visible
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Other users: visible if you share a game (uses function to avoid recursion)
CREATE POLICY "Users can view other users in their games"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.user_id = users.id
        AND public.is_player_in_game(game_players.game_id)
    )
  );

-- These should already exist but restate for safety
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);


-- ── 7. Ensure grants are in place ──────────────────────────────────────────

GRANT ALL ON public.games TO anon, authenticated;
GRANT ALL ON public.game_players TO anon, authenticated;
GRANT ALL ON public.moves TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
DO $$ BEGIN
  EXECUTE 'GRANT ALL ON public.chat_messages TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ── 8. Verify ───────────────────────────────────────────────────────────────

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
