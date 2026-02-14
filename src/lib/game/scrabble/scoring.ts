// ============================================================================
// Scrabble scoring logic
//
// Handles:
// - Calculating score for placed tiles with premium squares
// - Finding all words formed by a play
// - Bingo bonus (50 pts for using all 7 tiles)
// ============================================================================

import { PlacedTile, TilePlacement, FormedWord, BOARD_SIZE, BINGO_BONUS, RACK_SIZE } from './types';
import { getPremium, isValidPosition } from './board';
import { getTileValue } from './tiles';

/**
 * Given the board state and newly placed tiles, find all words formed.
 * Returns an array of FormedWord objects with the word, score, and cells.
 *
 * @param cells - The board AFTER placing the tiles
 * @param placements - The new tiles that were just placed
 * @returns Array of words formed, with scores. Empty if invalid.
 */
export function findFormedWords(
  cells: (PlacedTile | null)[][],
  placements: TilePlacement[]
): FormedWord[] {
  if (placements.length === 0) return [];

  const placedSet = new Set(placements.map(p => `${p.row},${p.col}`));
  const words: FormedWord[] = [];

  // Determine direction: all in same row (horizontal) or same col (vertical)
  const allSameRow = placements.every(p => p.row === placements[0].row);
  const allSameCol = placements.every(p => p.col === placements[0].col);

  // Single tile: check both directions
  if (placements.length === 1) {
    const hWord = getWordAt(cells, placements[0].row, placements[0].col, 'horizontal', placedSet);
    const vWord = getWordAt(cells, placements[0].row, placements[0].col, 'vertical', placedSet);
    if (hWord && hWord.word.length >= 2) words.push(hWord);
    if (vWord && vWord.word.length >= 2) words.push(vWord);
    return words;
  }

  if (allSameRow) {
    // Main word is horizontal
    const mainWord = getWordAt(cells, placements[0].row, placements[0].col, 'horizontal', placedSet);
    if (mainWord && mainWord.word.length >= 2) words.push(mainWord);

    // Check cross words (vertical) for each placed tile
    for (const p of placements) {
      const crossWord = getWordAt(cells, p.row, p.col, 'vertical', placedSet);
      if (crossWord && crossWord.word.length >= 2) words.push(crossWord);
    }
  } else if (allSameCol) {
    // Main word is vertical
    const mainWord = getWordAt(cells, placements[0].row, placements[0].col, 'vertical', placedSet);
    if (mainWord && mainWord.word.length >= 2) words.push(mainWord);

    // Check cross words (horizontal) for each placed tile
    for (const p of placements) {
      const crossWord = getWordAt(cells, p.row, p.col, 'horizontal', placedSet);
      if (crossWord && crossWord.word.length >= 2) words.push(crossWord);
    }
  }

  return words;
}

/**
 * Get a word at a given position in a given direction.
 * Walks in both directions from the start position to find the full word.
 * Calculates score including premium squares (only for newly placed tiles).
 */
function getWordAt(
  cells: (PlacedTile | null)[][],
  row: number,
  col: number,
  direction: 'horizontal' | 'vertical',
  newTilePositions: Set<string>
): FormedWord | null {
  const dr = direction === 'vertical' ? 1 : 0;
  const dc = direction === 'horizontal' ? 1 : 0;

  // Walk backwards to find the start of the word
  let startR = row;
  let startC = col;
  while (
    isValidPosition(startR - dr, startC - dc) &&
    cells[startR - dr][startC - dc] !== null
  ) {
    startR -= dr;
    startC -= dc;
  }

  // Walk forward to collect the word
  let r = startR;
  let c = startC;
  let wordStr = '';
  let wordScore = 0;
  let wordMultiplier = 1;
  const wordCells: { row: number; col: number }[] = [];

  while (isValidPosition(r, c) && cells[r][c] !== null) {
    const tile = cells[r][c]!;
    const isNewTile = newTilePositions.has(`${r},${c}`);
    let tileScore = tile.value;

    if (isNewTile) {
      // Apply premium squares only for newly placed tiles
      const premium = getPremium(r, c);
      if (premium === 'DL') tileScore *= 2;
      else if (premium === 'TL') tileScore *= 3;
      else if (premium === 'DW') wordMultiplier *= 2;
      else if (premium === 'TW') wordMultiplier *= 3;
    }

    wordScore += tileScore;
    wordStr += tile.letter;
    wordCells.push({ row: r, col: c });

    r += dr;
    c += dc;
  }

  if (wordStr.length < 2) return null;

  return {
    word: wordStr,
    score: wordScore * wordMultiplier,
    cells: wordCells,
  };
}

/**
 * Calculate the total score for a play, including bingo bonus.
 */
export function calculatePlayScore(
  cells: (PlacedTile | null)[][],
  placements: TilePlacement[]
): { words: FormedWord[]; totalScore: number } {
  const words = findFormedWords(cells, placements);

  let totalScore = words.reduce((sum, w) => sum + w.score, 0);

  // Bingo bonus: 50 points for using all 7 tiles
  if (placements.length === RACK_SIZE) {
    totalScore += BINGO_BONUS;
  }

  return { words, totalScore };
}

/**
 * Calculate remaining tile value for a player's rack (used at game end).
 */
export function calculateRackValue(rack: string[]): number {
  return rack.reduce((sum, letter) => sum + getTileValue(letter), 0);
}
