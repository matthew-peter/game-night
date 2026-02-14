// ============================================================================
// Scrabble board layout and premium squares
// Standard 15×15 board
// ============================================================================

import { BOARD_SIZE, PlacedTile, PremiumType } from './types';

/**
 * Premium square positions on a standard Scrabble board.
 * The board is symmetric across both diagonals and both axes.
 * We encode one quadrant + center and mirror.
 */
const PREMIUM_MAP: Record<string, PremiumType> = {};

// Triple Word scores
const TW_POSITIONS = [
  [0, 0], [0, 7], [0, 14],
  [7, 0], [7, 14],
  [14, 0], [14, 7], [14, 14],
];

// Double Word scores (includes center star at 7,7)
const DW_POSITIONS = [
  [1, 1], [1, 13],
  [2, 2], [2, 12],
  [3, 3], [3, 11],
  [4, 4], [4, 10],
  [7, 7], // center star
  [10, 4], [10, 10],
  [11, 3], [11, 11],
  [12, 2], [12, 12],
  [13, 1], [13, 13],
];

// Triple Letter scores
const TL_POSITIONS = [
  [1, 5], [1, 9],
  [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13],
  [13, 5], [13, 9],
];

// Double Letter scores
const DL_POSITIONS = [
  [0, 3], [0, 11],
  [2, 6], [2, 8],
  [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12],
  [11, 0], [11, 7], [11, 14],
  [12, 6], [12, 8],
  [14, 3], [14, 11],
];

// Build the map
for (const [r, c] of TW_POSITIONS) PREMIUM_MAP[`${r},${c}`] = 'TW';
for (const [r, c] of DW_POSITIONS) PREMIUM_MAP[`${r},${c}`] = 'DW';
for (const [r, c] of TL_POSITIONS) PREMIUM_MAP[`${r},${c}`] = 'TL';
for (const [r, c] of DL_POSITIONS) PREMIUM_MAP[`${r},${c}`] = 'DL';

/** Get the premium type for a board position */
export function getPremium(row: number, col: number): PremiumType {
  return PREMIUM_MAP[`${row},${col}`] ?? null;
}

/** Check if a position is within the board bounds */
export function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** Create an empty 15×15 board */
export function createEmptyBoard(): (PlacedTile | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

/** Check if a cell is occupied */
export function isOccupied(
  cells: (PlacedTile | null)[][],
  row: number,
  col: number
): boolean {
  return isValidPosition(row, col) && cells[row][col] !== null;
}

/** Check if a cell has an adjacent occupied cell */
export function hasAdjacentTile(
  cells: (PlacedTile | null)[][],
  row: number,
  col: number
): boolean {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return directions.some(([dr, dc]) => isOccupied(cells, row + dr, col + dc));
}

/** Check if the board is completely empty */
export function isBoardEmpty(cells: (PlacedTile | null)[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c] !== null) return false;
    }
  }
  return true;
}
