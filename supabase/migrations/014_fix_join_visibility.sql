-- ============================================================================
-- Migration 014: Allow joining players to see existing seats in waiting games
--
-- Without this, a player trying to join can't see which seats are taken
-- (because they're not in game_players yet), so they pick seat 0,
-- which collides with the creator's seat.
-- ============================================================================

DROP POLICY IF EXISTS "Players can view game_players in their games" ON public.game_players;

CREATE POLICY "Players can view game_players in their games"
  ON public.game_players FOR SELECT
  USING (
    public.is_player_in_game(game_id)
    OR EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = game_players.game_id
        AND games.status = 'waiting'
    )
  );
