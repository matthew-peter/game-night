-- ============================================================================
-- Migration 006: Multi-game platform
--
-- Transforms the 2-player Codenames-only schema into a multi-game, N-player
-- platform.  Key changes:
--
-- 1. game_players join table replaces player1_id / player2_id columns
-- 2. game_type discriminator on games table
-- 3. current_turn changes from TEXT ('player1'|'player2') to INTEGER (seat)
-- 4. key_card JSONB changes from { player1, player2 } to array indexed by seat
-- 5. Setup state in board_state uses arrays instead of playerN fields
-- 6. All RLS policies updated to use game_players
-- ============================================================================

-- ── 1. Create game_players table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_players (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id     UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seat        INTEGER NOT NULL,          -- 0-indexed seat number
  joined_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id),              -- can't join the same game twice
  UNIQUE(game_id, seat)                  -- one player per seat
);

CREATE INDEX IF NOT EXISTS idx_game_players_game ON public.game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON public.game_players(user_id);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Players can see who is in their games
CREATE POLICY "Players can view game_players in their games"
  ON public.game_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp2
      WHERE gp2.game_id = game_players.game_id
        AND gp2.user_id = auth.uid()
    )
  );

-- Authenticated users can join games (insert themselves)
CREATE POLICY "Players can join games"
  ON public.game_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Players can leave games (delete their own row)
CREATE POLICY "Players can leave games"
  ON public.game_players FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime so the waiting room can see when players join
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;


-- ── 2. Populate game_players from existing player1_id / player2_id ──────────

INSERT INTO public.game_players (game_id, user_id, seat)
SELECT id, player1_id, 0
FROM public.games
WHERE player1_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.game_players (game_id, user_id, seat)
SELECT id, player2_id, 1
FROM public.games
WHERE player2_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── 3. Add game_type column ─────────────────────────────────────────────────

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'codenames';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS min_players INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 2;


-- ── 4. Convert current_turn from TEXT to INTEGER (seat index) ───────────────

-- Drop the check constraint first
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_current_turn_check;

-- Drop the default before changing type (TEXT default can't auto-cast to INTEGER)
ALTER TABLE public.games ALTER COLUMN current_turn DROP DEFAULT;

-- Convert values: 'player1' -> 0, 'player2' -> 1
ALTER TABLE public.games
  ALTER COLUMN current_turn TYPE INTEGER
  USING CASE current_turn
    WHEN 'player1' THEN 0
    WHEN 'player2' THEN 1
    ELSE 0
  END;

-- Set the new INTEGER default
ALTER TABLE public.games ALTER COLUMN current_turn SET DEFAULT 0;


-- ── 5. Convert key_card JSONB from { player1, player2 } to array ────────────
--    Old: { "player1": { "agents": [...], "assassins": [...] },
--           "player2": { "agents": [...], "assassins": [...] } }
--    New: [ { "agents": [...], "assassins": [...] },    -- seat 0
--           { "agents": [...], "assassins": [...] } ]   -- seat 1

UPDATE public.games
SET key_card = jsonb_build_array(
  key_card->'player1',
  key_card->'player2'
)
WHERE key_card IS NOT NULL
  AND key_card ? 'player1';


-- ── 6. Move agents_found into board_state, update setup state ───────────────

-- Add agents_found array to board_state
UPDATE public.games
SET board_state = board_state || jsonb_build_object(
  'agents_found', jsonb_build_array(
    COALESCE(player1_agents_found, 0),
    COALESCE(player2_agents_found, 0)
  )
);

-- Convert setup state from playerN fields to arrays
-- Old: { player1SwapsUsed: 0, player2SwapsUsed: 0, player1Ready: false, player2Ready: false, ... }
-- New: { swapsUsed: [0, 0], ready: [false, false], ... }
UPDATE public.games
SET board_state = jsonb_set(
  board_state,
  '{setup}',
  jsonb_build_object(
    'enabled', COALESCE((board_state->'setup'->>'enabled')::boolean, false),
    'maxSwaps', COALESCE((board_state->'setup'->>'maxSwaps')::int, 3),
    'swapsUsed', jsonb_build_array(
      COALESCE((board_state->'setup'->>'player1SwapsUsed')::int, 0),
      COALESCE((board_state->'setup'->>'player2SwapsUsed')::int, 0)
    ),
    'ready', jsonb_build_array(
      COALESCE((board_state->'setup'->>'player1Ready')::boolean, false),
      COALESCE((board_state->'setup'->>'player2Ready')::boolean, false)
    )
  )
)
WHERE board_state->'setup' IS NOT NULL
  AND board_state->'setup' ? 'player1SwapsUsed';

-- Convert RevealedCard.guessedBy from 'player1'/'player2' to seat number
-- This updates every revealed card in every game's board_state
-- We need to iterate through the revealed map and update guessedBy values
DO $$
DECLARE
  game_row RECORD;
  word_key TEXT;
  card_val JSONB;
  new_revealed JSONB;
BEGIN
  FOR game_row IN SELECT id, board_state FROM public.games WHERE board_state->'revealed' IS NOT NULL LOOP
    new_revealed := '{}'::jsonb;
    FOR word_key, card_val IN SELECT * FROM jsonb_each(game_row.board_state->'revealed') LOOP
      IF card_val->>'guessedBy' = 'player1' THEN
        new_revealed := new_revealed || jsonb_build_object(word_key, card_val || '{"guessedBy": 0}'::jsonb);
      ELSIF card_val->>'guessedBy' = 'player2' THEN
        new_revealed := new_revealed || jsonb_build_object(word_key, card_val || '{"guessedBy": 1}'::jsonb);
      ELSE
        new_revealed := new_revealed || jsonb_build_object(word_key, card_val);
      END IF;
    END LOOP;
    UPDATE public.games
    SET board_state = jsonb_set(board_state, '{revealed}', new_revealed)
    WHERE id = game_row.id;
  END LOOP;
END $$;


-- ── 7. Drop ALL old RLS policies that reference player1_id / player2_id ─────
--    (Must happen BEFORE dropping the columns they depend on)

-- games policies
DROP POLICY IF EXISTS "Players can view their own games" ON public.games;
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "Players can update their games" ON public.games;
DROP POLICY IF EXISTS "Players can delete their own games" ON public.games;

-- moves policies
DROP POLICY IF EXISTS "Players can view moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can insert moves in their games" ON public.moves;
DROP POLICY IF EXISTS "Players can delete moves in their games" ON public.moves;

-- chat_messages policies
DROP POLICY IF EXISTS "Players can view chat messages in their games" ON public.chat_messages;
DROP POLICY IF EXISTS "Players can insert chat messages in their games" ON public.chat_messages;

-- users policies
DROP POLICY IF EXISTS "Users can view other users in their games" ON public.users;


-- ── 8. Drop old player columns ──────────────────────────────────────────────

-- Drop indexes first
DROP INDEX IF EXISTS idx_games_player1;
DROP INDEX IF EXISTS idx_games_player2;

-- Drop the columns (now safe — no policies depend on them)
ALTER TABLE public.games DROP COLUMN IF EXISTS player1_id;
ALTER TABLE public.games DROP COLUMN IF EXISTS player2_id;
ALTER TABLE public.games DROP COLUMN IF EXISTS player1_agents_found;
ALTER TABLE public.games DROP COLUMN IF EXISTS player2_agents_found;


-- ── 9. Create new RLS policies using game_players ─────────────────────────

-- games
CREATE POLICY "Players can view their own games"
  ON public.games FOR SELECT
  USING (
    status = 'waiting'  -- anyone can see waiting games (for joining)
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
    OR status = 'waiting'  -- allow joining a waiting game
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

-- moves
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

-- chat_messages
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

-- users
CREATE POLICY "Users can view other users in their games"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.game_players gp1
      JOIN public.game_players gp2 ON gp1.game_id = gp2.game_id
      WHERE gp1.user_id = auth.uid()
        AND gp2.user_id = users.id
    )
  );
