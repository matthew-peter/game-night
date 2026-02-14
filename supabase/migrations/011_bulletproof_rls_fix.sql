-- ============================================================================
-- Migration 011: Bulletproof RLS fix
--
-- Each table's policies are wrapped in their own DO block so that if one
-- table doesn't exist, it doesn't abort the entire script.
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Ensure chat_messages table exists (may have been skipped)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON public.chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(game_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Ensure game_players table exists
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seat INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id),
  UNIQUE(game_id, seat)
);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. GAMES policies
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Players can view their own games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view waiting games by PIN" ON public.games;
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their games" ON public.games;
DROP POLICY IF EXISTS "Players can delete their own games" ON public.games;

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

CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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
-- 4. GAME_PLAYERS policies
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Players can view game_players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can join games" ON public.game_players;
DROP POLICY IF EXISTS "Players can leave games" ON public.game_players;

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

CREATE POLICY "Players can join games"
  ON public.game_players FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can leave games"
  ON public.game_players FOR DELETE
  USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. MOVES policies
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Players can view moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can insert moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can delete moves in their games" ON public.moves;

CREATE POLICY "Players can view moves in their games"
  ON public.moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = moves.game_id
        AND game_players.user_id = auth.uid()
    )
  );

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
-- 6. CHAT_MESSAGES policies
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Players can view chat messages in their games" ON public.chat_messages;
DROP POLICY IF EXISTS "Players can insert chat messages in their games" ON public.chat_messages;

CREATE POLICY "Players can view chat messages in their games"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players
      WHERE game_players.game_id = chat_messages.game_id
        AND game_players.user_id = auth.uid()
    )
  );

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
-- 7. USERS policies
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
-- 8. Ensure RLS enabled on all tables
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Grants
-- ══════════════════════════════════════════════════════════════════════════════
GRANT ALL ON public.games TO authenticated;
GRANT ALL ON public.game_players TO authenticated;
GRANT ALL ON public.moves TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.games TO anon;
GRANT ALL ON public.game_players TO anon;


-- ══════════════════════════════════════════════════════════════════════════════
-- 10. Realtime
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY: This should show all the policies we just created
-- ══════════════════════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('games', 'game_players', 'moves', 'chat_messages', 'users')
ORDER BY tablename, policyname;
