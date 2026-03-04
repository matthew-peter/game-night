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
  DictionaryMode,
  RACK_SIZE,
  MAX_SCORELESS_TURNS,
} from './types';
import { createEmptyBoard } from './board';
import { createTileBag, drawTiles, returnTilesToBag, getTileValue } from './tiles';
import { calculatePlayScore, calculateRackValue } from './scoring';
import { validatePlacement, validateExchange } from './validation';
import { isInDictionary } from './dictionary';

// ── Game Creation ────────────────────────────────────────────────────────────

/**
 * Create initial Scrabble board state for a new game.
 * Shuffles the bag and deals 7 tiles to each player.
 */
export function createScrabbleBoardState(
  playerCount: number,
  dictionaryMode: DictionaryMode = 'friendly'
): ScrabbleBoardState {
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
    dictionaryMode,
  };
}

// ── Move Processing ──────────────────────────────────────────────────────────

export interface PlaceTilesResult {
  success: boolean;
  error?: string;
  invalidWords?: string[];
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

  // Validate the placement (uses dictionary mode from board state)
  const validation = validatePlacement(
    boardState,
    placements,
    rack,
    boardState.dictionaryMode
  );
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      invalidWords: validation.invalidWords,
    };
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
    consecutivePasses: 0,
    firstMoveMade: true,
    turnNumber: boardState.turnNumber + 1,
    dictionaryMode: boardState.dictionaryMode,
    lastPlay: {
      playerSeat,
      type: 'place',
      tiles: placements,
      words,
      totalScore,
      tilesDrawn: drawn,
      previousConsecutivePasses: boardState.consecutivePasses,
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
  gameOver?: boolean;
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
  const newConsecutivePasses = boardState.consecutivePasses + 1;
  const gameOver = newConsecutivePasses >= MAX_SCORELESS_TURNS;

  const newBoardState: ScrabbleBoardState = {
    ...boardState,
    tileBag: newBag,
    racks: newRacks,
    consecutivePasses: newConsecutivePasses,
    turnNumber: boardState.turnNumber + 1,
    lastPlay: {
      playerSeat,
      type: 'exchange',
      tilesExchanged: tilesToExchange.length,
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

export interface PassResult {
  success: boolean;
  newBoardState: ScrabbleBoardState;
  nextTurn: Seat;
  gameOver: boolean;
}

/**
 * Process a pass move.
 * Increments consecutive scoreless turn counter.
 * Game ends after 6 consecutive scoreless turns (standard Scrabble rule).
 */
export function passTurn(
  boardState: ScrabbleBoardState,
  playerSeat: Seat,
  playerCount: number
): PassResult {
  const newConsecutivePasses = boardState.consecutivePasses + 1;
  const gameOver = newConsecutivePasses >= MAX_SCORELESS_TURNS;

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

// ── Challenge ────────────────────────────────────────────────────────────────

export interface ChallengeResult {
  success: boolean;
  error?: string;
  challengeValid: boolean; // true = word was invalid, play reversed
  invalidWords?: string[];
  newBoardState?: ScrabbleBoardState;
  nextTurn?: Seat;
}

/**
 * Process a challenge against the last play.
 * Checks all words from the last play against the dictionary.
 * If any word is invalid: reverses the play, restores the board, turn goes
 * back to the challenged player.
 * If all words are valid: challenge fails, play stands, current player continues.
 */
export function challengePlay(
  boardState: ScrabbleBoardState,
  challengerSeat: Seat,
  playerCount: number,
): ChallengeResult {
  const lp = boardState.lastPlay;
  if (!lp || lp.type !== 'place' || !lp.tiles || !lp.words) {
    return { success: false, error: 'No play to challenge', challengeValid: false };
  }

  // Check all formed words against dictionary
  const invalid: string[] = [];
  for (const w of lp.words) {
    if (!isInDictionary(w.word)) {
      invalid.push(w.word);
    }
  }

  if (invalid.length === 0) {
    // Challenge fails — all words valid. No state change.
    return { success: true, challengeValid: false, nextTurn: challengerSeat };
  }

  // Challenge succeeds — reverse the play
  const newCells = boardState.cells.map(row => row.map(c => c ? { ...c } : null));
  for (const p of lp.tiles) {
    newCells[p.row][p.col] = null;
  }

  // Restore the challenged player's rack: remove drawn tiles, add back played tiles
  const challengedSeat = lp.playerSeat;
  const currentRack = [...boardState.racks[challengedSeat]];

  // Remove drawn tiles from rack
  const tilesDrawn = lp.tilesDrawn ?? [];
  for (const t of tilesDrawn) {
    const idx = currentRack.indexOf(t);
    if (idx !== -1) currentRack.splice(idx, 1);
  }

  // Add back the tiles that were played (blanks go back as '_')
  for (const p of lp.tiles) {
    currentRack.push(p.isBlank ? '_' : p.letter);
  }

  const newRacks = boardState.racks.map((r, i) =>
    i === challengedSeat ? currentRack : [...r]
  );

  // Return drawn tiles to the bag
  const newBag = [...boardState.tileBag, ...tilesDrawn];

  // Subtract the score that was awarded
  const newScores = [...boardState.scores];
  newScores[challengedSeat] -= (lp.totalScore ?? 0);

  // Turn goes back to the challenged player
  const nextTurn = challengedSeat as Seat;

  const newBoardState: ScrabbleBoardState = {
    cells: newCells,
    tileBag: newBag,
    racks: newRacks,
    scores: newScores,
    consecutivePasses: lp.previousConsecutivePasses ?? 0,
    firstMoveMade: boardState.firstMoveMade && boardState.turnNumber > 2,
    turnNumber: boardState.turnNumber,
    dictionaryMode: boardState.dictionaryMode,
    lastPlay: undefined,
  };

  return {
    success: true,
    challengeValid: true,
    invalidWords: invalid,
    newBoardState,
    nextTurn,
  };
}

// ── End Game ─────────────────────────────────────────────────────────────────

/**
 * Apply end-game scoring when a player goes out (uses all tiles with empty bag).
 * Standard Scrabble: the player who went out gets the sum of all other
 * players' remaining rack values added to their score.
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
 * Check if the game should end due to consecutive scoreless turns.
 * Standard rule: 6 consecutive scoreless turns ends the game.
 */
export function shouldEndFromPasses(boardState: ScrabbleBoardState): boolean {
  return boardState.consecutivePasses >= MAX_SCORELESS_TURNS;
}
