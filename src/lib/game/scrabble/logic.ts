// ============================================================================
// Scrabble game logic
//
// Manages game state transitions:
// - Creating a new game (shuffle bag, deal racks)
// - Processing tile placement moves
// - Processing tile exchanges
// - Processing passes
// - Game end detection and final scoring
// ============================================================================

import { Seat } from '@/lib/supabase/types';
import {
  ScrabbleBoardState,
  TilePlacement,
  PlacedTile,
  ScrabbleMoveType,
  RACK_SIZE,
} from './types';
import { createEmptyBoard } from './board';
import { createTileBag, drawTiles, returnTilesToBag, getTileValue } from './tiles';
import { calculatePlayScore, calculateRackValue } from './scoring';
import { validatePlacement, validateExchange } from './validation';

// ── Game Creation ────────────────────────────────────────────────────────────

/**
 * Create initial Scrabble board state for a new game.
 * Shuffles the bag and deals 7 tiles to each player.
 */
export function createScrabbleBoardState(playerCount: number): ScrabbleBoardState {
  const bag = createTileBag();
  const racks: string[][] = [];

  for (let i = 0; i < playerCount; i++) {
    racks.push(drawTiles(bag, RACK_SIZE));
  }

  return {
    cells: createEmptyBoard(),
    tileBag: bag,
    racks,
    scores: Array(playerCount).fill(0),
    consecutivePasses: 0,
    firstMoveMade: false,
    turnNumber: 1,
  };
}

// ── Move Processing ──────────────────────────────────────────────────────────

export interface PlaceTilesResult {
  success: boolean;
  error?: string;
  newBoardState?: ScrabbleBoardState;
  wordsFormed?: { word: string; score: number }[];
  totalScore?: number;
  nextTurn?: Seat;
  gameOver?: boolean;
}

/**
 * Process a tile placement move.
 * Validates, scores, updates board, draws new tiles, advances turn.
 */
export function placeTiles(
  boardState: ScrabbleBoardState,
  placements: TilePlacement[],
  playerSeat: Seat,
  playerCount: number
): PlaceTilesResult {
  const rack = boardState.racks[playerSeat];

  // Validate the placement
  const validation = validatePlacement(boardState, placements, rack);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Apply tiles to the board
  const newCells = boardState.cells.map(row => row.map(cell => cell ? { ...cell } : null));
  for (const p of placements) {
    const value = p.isBlank ? 0 : getTileValue(p.letter);
    newCells[p.row][p.col] = {
      letter: p.letter.toUpperCase(),
      value,
      isBlank: p.isBlank,
    } as PlacedTile;
  }

  // Calculate score
  const { words, totalScore } = calculatePlayScore(newCells, placements);

  // Update rack: remove used tiles, draw new ones
  const newRack = [...rack];
  for (const p of placements) {
    const tileToRemove = p.isBlank ? '_' : p.letter;
    const idx = newRack.indexOf(tileToRemove);
    if (idx !== -1) newRack.splice(idx, 1);
  }

  const newBag = [...boardState.tileBag];
  const drawn = drawTiles(newBag, placements.length);
  newRack.push(...drawn);

  // Update racks
  const newRacks = boardState.racks.map((r, i) =>
    i === playerSeat ? newRack : [...r]
  );

  // Update scores
  const newScores = [...boardState.scores];
  newScores[playerSeat] += totalScore;

  // Advance turn
  const nextTurn = (playerSeat + 1) % playerCount as Seat;

  // Check for game over: player used all tiles and bag is empty
  const playerOutOfTiles = newRack.length === 0 && newBag.length === 0;

  const newBoardState: ScrabbleBoardState = {
    cells: newCells,
    tileBag: newBag,
    racks: newRacks,
    scores: newScores,
    consecutivePasses: 0, // Reset on successful play
    firstMoveMade: true,
    turnNumber: boardState.turnNumber + 1,
    lastPlay: {
      playerSeat,
      type: 'place',
      tiles: placements,
      words,
      totalScore,
    },
  };

  // Final scoring if game over
  if (playerOutOfTiles) {
    applyEndGameScoring(newBoardState, playerSeat);
  }

  return {
    success: true,
    newBoardState,
    wordsFormed: words,
    totalScore,
    nextTurn,
    gameOver: playerOutOfTiles,
  };
}

export interface ExchangeResult {
  success: boolean;
  error?: string;
  newBoardState?: ScrabbleBoardState;
  nextTurn?: Seat;
}

/**
 * Process a tile exchange move.
 * Returns tiles to bag, draws new ones.
 */
export function exchangeTiles(
  boardState: ScrabbleBoardState,
  tilesToExchange: string[],
  playerSeat: Seat,
  playerCount: number
): ExchangeResult {
  const rack = boardState.racks[playerSeat];

  const validation = validateExchange(boardState, tilesToExchange, rack);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Remove tiles from rack
  const newRack = [...rack];
  for (const tile of tilesToExchange) {
    const idx = newRack.indexOf(tile);
    if (idx !== -1) newRack.splice(idx, 1);
  }

  // Draw new tiles first, then return old ones
  const newBag = [...boardState.tileBag];
  const drawn = drawTiles(newBag, tilesToExchange.length);
  newRack.push(...drawn);

  // Return exchanged tiles to bag
  returnTilesToBag(newBag, tilesToExchange);

  const newRacks = boardState.racks.map((r, i) =>
    i === playerSeat ? newRack : [...r]
  );

  const nextTurn = (playerSeat + 1) % playerCount as Seat;

  return {
    success: true,
    newBoardState: {
      ...boardState,
      tileBag: newBag,
      racks: newRacks,
      consecutivePasses: boardState.consecutivePasses + 1,
      turnNumber: boardState.turnNumber + 1,
      lastPlay: {
        playerSeat,
        type: 'exchange',
        tilesExchanged: tilesToExchange.length,
      },
    },
    nextTurn,
  };
}

export interface PassResult {
  success: boolean;
  newBoardState: ScrabbleBoardState;
  nextTurn: Seat;
  gameOver: boolean;
}

/**
 * Process a pass move.
 * Increments consecutive pass counter. Game ends if all players pass consecutively.
 */
export function passTurn(
  boardState: ScrabbleBoardState,
  playerSeat: Seat,
  playerCount: number
): PassResult {
  const newConsecutivePasses = boardState.consecutivePasses + 1;
  const gameOver = newConsecutivePasses >= playerCount * 2; // Each player passes twice

  const nextTurn = (playerSeat + 1) % playerCount as Seat;

  const newBoardState: ScrabbleBoardState = {
    ...boardState,
    consecutivePasses: newConsecutivePasses,
    turnNumber: boardState.turnNumber + 1,
    lastPlay: {
      playerSeat,
      type: 'pass',
    },
  };

  if (gameOver) {
    // Subtract remaining rack values from each player's score
    for (let i = 0; i < playerCount; i++) {
      const rackValue = calculateRackValue(newBoardState.racks[i]);
      newBoardState.scores[i] -= rackValue;
    }
  }

  return {
    success: true,
    newBoardState,
    nextTurn,
    gameOver,
  };
}

// ── End Game ─────────────────────────────────────────────────────────────────

/**
 * Apply end-game scoring when a player goes out (uses all tiles with empty bag).
 * The player who went out gets the sum of all other players' rack values added to their score.
 * All other players have their rack values subtracted.
 */
function applyEndGameScoring(boardState: ScrabbleBoardState, winnerSeat: Seat): void {
  let totalOtherRackValue = 0;

  for (let i = 0; i < boardState.racks.length; i++) {
    if (i !== winnerSeat) {
      const rackValue = calculateRackValue(boardState.racks[i]);
      totalOtherRackValue += rackValue;
      boardState.scores[i] -= rackValue;
    }
  }

  boardState.scores[winnerSeat] += totalOtherRackValue;
}

/**
 * Determine the winner(s) of a completed game.
 * Returns seat indices of player(s) with the highest score.
 */
export function getWinners(boardState: ScrabbleBoardState): Seat[] {
  const maxScore = Math.max(...boardState.scores);
  return boardState.scores
    .map((score, seat) => ({ score, seat }))
    .filter(({ score }) => score === maxScore)
    .map(({ seat }) => seat);
}

/**
 * Check if the game should end due to consecutive passes.
 */
export function shouldEndFromPasses(
  boardState: ScrabbleBoardState,
  playerCount: number
): boolean {
  return boardState.consecutivePasses >= playerCount * 2;
}
