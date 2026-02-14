-- Chat messages table for persistent in-game chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by game
CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON public.chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(game_id, created_at);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Players can view chat messages in their games
CREATE POLICY "Players can view chat messages in their games"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = chat_messages.game_id
        AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );

-- Players can insert chat messages in their games
CREATE POLICY "Players can insert chat messages in their games"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = game_id
        AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );

-- Enable realtime for chat messages
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
