-- ============================================================================
-- Migration 010: Comprehensive RLS policy fix
--
-- Migration 006 likely failed partway through due to constraint errors,
-- meaning the new RLS policies were never created. This script
-- idempotently drops and recreates ALL policies for the multi-game platform.
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. GAMES table policies
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop any/all existing policies
DROP POLICY IF EXISTS "Players can view their own games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view waiting games by PIN" ON public.games;
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their games" ON public.games;
DROP POLICY IF EXISTS "Players can delete their own games" ON public.games;

-- SELECT: see your own games, or any waiting game (for joining)
CREATE POLICY "Players can view their own games"
  ON public.games FOR SELECT
  USING (
    status = 'waiting'
    OR EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = games.id
        AND game_players.user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create a game
CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: players in the game, or anyone can update a waiting game (for joining)
CREATE POLICY "Players can update their games"
  ON public.games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = games.id
        AND game_players.user_id = auth.uid()
    )
    OR status = 'waiting'
  );

-- DELETE: only players in the game
CREATE POLICY "Players can delete their own games"
  ON public.games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = games.id
        AND game_players.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. GAME_PLAYERS table policies
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Players can view game_players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can join games" ON public.game_players;
DROP POLICY IF EXISTS "Players can leave games" ON public.game_players;

-- SELECT: see your own rows, or rows of people in your games
CREATE POLICY "Players can view game_players in their games"
  ON public.game_players FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = game_players.game_id
        AND gp.user_id = auth.uid()
    )
  );

-- INSERT: you can add yourself
CREATE POLICY "Players can join games"
  ON public.game_players FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: you can remove yourself
CREATE POLICY "Players can leave games"
  ON public.game_players FOR DELETE
  USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. MOVES table policies
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Players can view moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can insert moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can delete moves in their games" ON public.moves;

-- SELECT
CREATE POLICY "Players can view moves in their games"
  ON public.moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = moves.game_id
        AND game_players.user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Players can insert moves in their games"
  ON public.moves FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = game_id
        AND game_players.user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "Players can delete moves in their games"
  ON public.moves FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = moves.game_id
        AND game_players.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. CHAT_MESSAGES table policies
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Players can view chat messages in their games" ON public.chat_messages;
DROP POLICY IF EXISTS "Players can insert chat messages in their games" ON public.chat_messages;

-- SELECT
CREATE POLICY "Players can view chat messages in their games"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = chat_messages.game_id
        AND game_players.user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Players can insert chat messages in their games"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = game_id
        AND game_players.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. USERS table policies (from migration 008, repeated for safety)
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view other users in their games" ON public.users;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

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


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Ensure RLS is enabled on all tables
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Ensure grants are in place
-- ══════════════════════════════════════════════════════════════════════════════

GRANT ALL ON public.games TO authenticated;
GRANT ALL ON public.game_players TO authenticated;
GRANT ALL ON public.moves TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT ALL ON public.users TO authenticated;

GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.game_players TO anon;
GRANT ALL ON public.game_players TO anon;
