-- Codenames Duet Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  words TEXT[] NOT NULL,
  key_card JSONB NOT NULL,
  pin TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'completed', 'abandoned')),
  timer_tokens INTEGER NOT NULL DEFAULT 9,
  clue_strictness TEXT NOT NULL DEFAULT 'strict' CHECK (clue_strictness IN ('basic', 'strict', 'very_strict')),
  current_turn TEXT DEFAULT 'player1' CHECK (current_turn IN ('player1', 'player2')),
  current_phase TEXT DEFAULT 'clue' CHECK (current_phase IN ('clue', 'guess')),
  current_clue_id UUID,
  board_state JSONB NOT NULL DEFAULT '{"revealed": [], "revealedBy": []}',
  player1_agents_found INTEGER NOT NULL DEFAULT 0,
  player2_agents_found INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('win', 'loss')),
  sudden_death BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Moves table
CREATE TABLE public.moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  move_type TEXT NOT NULL CHECK (move_type IN ('clue', 'guess', 'end_turn')),
  clue_word TEXT,
  clue_number INTEGER,
  intended_words INTEGER[],
  guess_index INTEGER,
  guess_result TEXT CHECK (guess_result IN ('agent', 'assassin', 'bystander')),
  clue_id UUID REFERENCES public.moves(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for current_clue_id after moves table exists
ALTER TABLE public.games 
ADD CONSTRAINT games_current_clue_id_fkey 
FOREIGN KEY (current_clue_id) REFERENCES public.moves(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_games_pin ON public.games(pin);
CREATE INDEX idx_games_player1 ON public.games(player1_id);
CREATE INDEX idx_games_player2 ON public.games(player2_id);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_moves_game_id ON public.moves(game_id);
CREATE INDEX idx_moves_player_id ON public.moves(player_id);
CREATE INDEX idx_moves_clue_id ON public.moves(clue_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Users policies
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
      SELECT 1 FROM public.games 
      WHERE (player1_id = auth.uid() OR player2_id = auth.uid())
        AND (player1_id = users.id OR player2_id = users.id)
    )
  );

-- Games policies
CREATE POLICY "Players can view their own games"
  ON public.games FOR SELECT
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Anyone can view waiting games by PIN"
  ON public.games FOR SELECT
  USING (status = 'waiting');

CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update their games"
  ON public.games FOR UPDATE
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

-- Moves policies
CREATE POLICY "Players can view moves in their games"
  ON public.moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
        AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );

CREATE POLICY "Players can insert moves in their games"
  ON public.moves FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = game_id 
        AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
        AND games.status = 'playing'
    )
  );

-- Enable realtime for games and moves
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
