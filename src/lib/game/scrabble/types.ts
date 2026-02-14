// ============================================================================
// Scrabble-specific types
// ============================================================================

import { Seat } from '@/lib/supabase/types';

/** A tile that has been placed on the board */
export interface PlacedTile {
  letter: string;   // The displayed letter (A-Z)
  value: number;    // Point value (0 for blanks)
  isBlank: boolean; // Was this originally a blank tile?
}

/** A tile in a player's rack or the bag */
export type TileLetter = string; // 'A'-'Z' or '_' for blank

/** Premium square types */
export type PremiumType = 'TW' | 'DW' | 'TL' | 'DL' | null;

/** A tile placement in a move */
export interface TilePlacement {
  row: number;
  col: number;
  letter: string;      // The letter to display
  isBlank: boolean;     // Whether a blank tile was used
}

/** Info about a word formed during a play */
export interface FormedWord {
  word: string;
  score: number;
  cells: { row: number; col: number }[];
}

/** Info about the last play (for display) */
export interface LastPlay {
  playerSeat: Seat;
  type: 'place' | 'exchange' | 'pass';
  tiles?: TilePlacement[];
  words?: FormedWord[];
  totalScore?: number;
  tilesExchanged?: number;
}

/** The complete Scrabble board state stored in game.board_state */
export interface ScrabbleBoardState {
  /** 15×15 grid. null = empty cell */
  cells: (PlacedTile | null)[][];

  /** Tiles remaining in the bag (shuffled) */
  tileBag: TileLetter[];

  /** Each player's rack, indexed by seat. racks[0] = seat 0's tiles */
  racks: TileLetter[][];

  /** Scores per player, indexed by seat */
  scores: number[];

  /** Number of consecutive passes (game ends at 2× player count) */
  consecutivePasses: number;

  /** Whether any tiles have been placed on the board yet */
  firstMoveMade: boolean;

  /** Info about the most recent play */
  lastPlay?: LastPlay;

  /** Turn number (for display) */
  turnNumber: number;
}

/** Scrabble move types */
export type ScrabbleMoveType = 'place_tiles' | 'exchange_tiles' | 'pass';

/** Data stored in move_data JSONB for Scrabble moves */
export interface ScrabbleMoveData {
  moveType: ScrabbleMoveType;
  placements?: TilePlacement[];
  wordsFormed?: FormedWord[];
  totalScore?: number;
  tilesExchanged?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;
export const CENTER_ROW = 7;
export const CENTER_COL = 7;
export const BINGO_BONUS = 50;
