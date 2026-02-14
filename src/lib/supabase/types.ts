// Database types for Supabase

export type UserRole = 'player1' | 'player2';
export type GameStatus = 'waiting' | 'playing' | 'completed' | 'abandoned';
export type MoveType = 'clue' | 'guess' | 'end_turn';
export type CardType = 'agent' | 'bystander' | 'assassin';
export type ClueStrictness = 'basic' | 'strict' | 'very_strict';
export type CurrentTurn = 'player1' | 'player2';

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface KeyCardSide {
  agents: number[]; // indices 0-24 that are agents for this side
  assassins: number[]; // indices 0-24 that are assassins for this side
  // remaining are bystanders
}

export interface KeyCard {
  player1: KeyCardSide;
  player2: KeyCardSide;
}

export interface RevealedCard {
  type: CardType;
  guessedBy: UserRole;
}

/** Pre-game setup state for word swaps */
export interface SetupState {
  enabled: boolean;
  maxSwaps: number;
  player1SwapsUsed: number;
  player2SwapsUsed: number;
  player1Ready: boolean;
  player2Ready: boolean;
}

export interface BoardState {
  revealed: Record<string, RevealedCard>; // word -> revealed info
  setup?: SetupState; // present during pre-game setup phase
}

export interface Game {
  id: string;
  pin: string;
  status: GameStatus;
  player1_id: string;
  player2_id: string | null;
  key_card: KeyCard;
  words: string[];
  board_state: BoardState;
  timer_tokens: number;
  current_turn: CurrentTurn;
  current_phase: 'clue' | 'guess';
  current_clue_id: string | null;
  clue_strictness: ClueStrictness;
  player1_agents_found: number;
  player2_agents_found: number;
  result: 'win' | 'loss' | null;
  sudden_death: boolean;
  created_at: string;
  ended_at: string | null;
}

export interface Move {
  id: string;
  game_id: string;
  player_id: string;
  move_type: MoveType;
  clue_word: string | null;
  clue_number: number | null;
  intended_words: number[] | null;  // indices of intended words
  guess_index: number | null;
  guess_result: CardType | null;
  clue_id: string | null;  // reference to the clue move this guess relates to
  created_at: string;
}

export interface Invite {
  id: string;
  game_id: string;
  from_user_id: string;
  invite_code: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
}

// Database schema type for Supabase
// Using a more permissive type since we don't have auto-generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
