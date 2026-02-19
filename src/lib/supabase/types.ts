// ============================================================================
// Database types for the multi-game platform
//
// Key design: players are identified by their SEAT index (0-based integer)
// rather than 'player1'/'player2' string literals.  This supports 2–4 player
// games uniformly.  Game-specific state lives in typed interfaces but the
// shared infrastructure (auth, chat, notifications) only cares about Game,
// GamePlayer, and User.
// ============================================================================

/** Seat index (0-based).  For 2-player games: 0 and 1. */
export type Seat = number;

export type GameType = 'codenames' | 'scrabble' | 'so_clover';
export type GameStatus = 'waiting' | 'playing' | 'completed' | 'abandoned';
export type MoveType = 'clue' | 'guess' | 'end_turn' | 'place_tiles' | 'exchange_tiles' | 'pass' | 'submit_clues' | 'place_cards' | 'submit_guess';
export type CardType = 'agent' | 'bystander' | 'assassin';
export type ClueStrictness = 'basic' | 'strict' | 'very_strict';

// ── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  created_at: string;
}

// ── Game Players (join table) ───────────────────────────────────────────────

export interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  seat: Seat;
  joined_at: string;
  /** Populated via Supabase join: game_players(*, user:users(username)) */
  user?: { username: string };
}

// ── Key Card (Codenames) ────────────────────────────────────────────────────

export interface KeyCardSide {
  agents: number[];    // word indices that are agents for this side
  assassins: number[]; // word indices that are assassins for this side
  // remaining are bystanders
}

/**
 * Array indexed by seat.  For Codenames Duet, always length 2.
 * keyCard[0] = seat 0's view, keyCard[1] = seat 1's view.
 */
export type KeyCard = KeyCardSide[];

// ── Board State ─────────────────────────────────────────────────────────────

export interface RevealedCard {
  type: CardType;
  guessedBy: Seat;
}

/** Pre-game setup state for word swaps */
export interface SetupState {
  enabled: boolean;
  maxSwaps: number;
  swapsUsed: number[];   // indexed by seat, e.g. [0, 2] = seat 0 used 0, seat 1 used 2
  ready: boolean[];      // indexed by seat, e.g. [true, false]
}

export interface BoardState {
  revealed: Record<string, RevealedCard>;  // word -> revealed info
  agents_found?: number[];                 // indexed by seat
  setup?: SetupState;                      // present during pre-game setup phase
}

// ── Game ────────────────────────────────────────────────────────────────────

export interface Game {
  id: string;
  game_type: GameType;
  pin: string;
  status: GameStatus;
  min_players: number;
  max_players: number;

  // Turn management (seat-indexed)
  current_turn: Seat;          // seat of the clue giver (Codenames) or active player
  current_phase: 'clue' | 'guess' | 'play' | 'clue_writing' | 'resolution';
  current_clue_id: string | null;

  // Codenames-specific columns (nullable for other game types)
  key_card: KeyCard;
  words: string[];
  board_state: BoardState;
  timer_tokens: number;
  clue_strictness: ClueStrictness;
  sudden_death: boolean;

  // Outcome
  result: 'win' | 'loss' | null;

  // Timestamps
  created_at: string;
  updated_at?: string;
  ended_at: string | null;

  // Populated via Supabase join: games(*, game_players(*))
  game_players?: GamePlayer[];
}

// ── Moves ───────────────────────────────────────────────────────────────────

export interface Move {
  id: string;
  game_id: string;
  player_id: string;
  move_type: MoveType;
  clue_word: string | null;
  clue_number: number | null;
  intended_words: number[] | null;
  guess_index: number | null;
  guess_result: CardType | null;
  clue_id: string | null;
  move_data: Record<string, unknown> | null; // Game-specific move data (Scrabble placements, etc.)
  created_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find a user's seat in a game.
 * Returns undefined if the user isn't a player in this game.
 */
export function findSeat(
  players: GamePlayer[] | undefined,
  userId: string
): Seat | undefined {
  return players?.find((p) => p.user_id === userId)?.seat;
}

/**
 * Get all other players (not the given userId) from a game's player list.
 */
export function getOtherPlayers(
  players: GamePlayer[] | undefined,
  userId: string
): GamePlayer[] {
  return players?.filter((p) => p.user_id !== userId) ?? [];
}

/**
 * Get the player at a specific seat.
 */
export function getPlayerAtSeat(
  players: GamePlayer[] | undefined,
  seat: Seat
): GamePlayer | undefined {
  return players?.find((p) => p.seat === seat);
}

// ── Legacy compat (unused, kept temporarily for reference) ──────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
