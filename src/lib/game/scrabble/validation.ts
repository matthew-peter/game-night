// ============================================================================
// Scrabble move validation
//
// Validates tile placements:
// - All tiles in a straight line (row or column)
// - No gaps between placed tiles (accounting for existing tiles)
// - Connected to existing tiles (or covers center on first move)
// - All formed words are valid dictionary words
// ============================================================================

import { PlacedTile, TilePlacement, ScrabbleBoardState, BOARD_SIZE, CENTER_ROW, CENTER_COL } from './types';
import { isValidPosition, hasAdjacentTile } from './board';
import { findFormedWords } from './scoring';
import { isValidWord } from './dictionary';
import { getTileValue } from './tiles';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a tile placement move.
 * Returns { valid: true } or { valid: false, error: "..." }.
 */
export function validatePlacement(
  boardState: ScrabbleBoardState,
  placements: TilePlacement[],
  playerRack: string[]
): ValidationResult {
  if (placements.length === 0) {
    return { valid: false, error: 'You must place at least one tile' };
  }

  // 1. Check all positions are valid and empty
  for (const p of placements) {
    if (!isValidPosition(p.row, p.col)) {
      return { valid: false, error: 'Tile position is off the board' };
    }
    if (boardState.cells[p.row][p.col] !== null) {
      return { valid: false, error: 'Cannot place a tile on an occupied cell' };
    }
  }

  // 2. Check no duplicate positions
  const posSet = new Set(placements.map(p => `${p.row},${p.col}`));
  if (posSet.size !== placements.length) {
    return { valid: false, error: 'Cannot place multiple tiles on the same cell' };
  }

  // 3. Check tiles are available in the player's rack
  const rackCopy = [...playerRack];
  for (const p of placements) {
    const needed = p.isBlank ? '_' : p.letter;
    const idx = rackCopy.indexOf(needed);
    if (idx === -1) {
      return { valid: false, error: `You don't have the tile "${p.letter}" in your rack` };
    }
    rackCopy.splice(idx, 1);
  }

  // 4. Check all tiles are in a straight line
  const allSameRow = placements.every(p => p.row === placements[0].row);
  const allSameCol = placements.every(p => p.col === placements[0].col);

  if (!allSameRow && !allSameCol) {
    return { valid: false, error: 'All tiles must be placed in a single row or column' };
  }

  // 5. Check for gaps (tiles must be contiguous when combined with existing tiles)
  if (allSameRow) {
    const row = placements[0].row;
    const cols = placements.map(p => p.col).sort((a, b) => a - b);
    const minCol = cols[0];
    const maxCol = cols[cols.length - 1];

    for (let c = minCol; c <= maxCol; c++) {
      const hasPlaced = posSet.has(`${row},${c}`);
      const hasExisting = boardState.cells[row][c] !== null;
      if (!hasPlaced && !hasExisting) {
        return { valid: false, error: 'There is a gap in your word — tiles must be contiguous' };
      }
    }
  } else {
    const col = placements[0].col;
    const rows = placements.map(p => p.row).sort((a, b) => a - b);
    const minRow = rows[0];
    const maxRow = rows[rows.length - 1];

    for (let r = minRow; r <= maxRow; r++) {
      const hasPlaced = posSet.has(`${r},${col}`);
      const hasExisting = boardState.cells[r][col] !== null;
      if (!hasPlaced && !hasExisting) {
        return { valid: false, error: 'There is a gap in your word — tiles must be contiguous' };
      }
    }
  }

  // 6. Check connectivity
  if (!boardState.firstMoveMade) {
    // First move: must cover center square
    const coversCenter = placements.some(
      p => p.row === CENTER_ROW && p.col === CENTER_COL
    );
    if (!coversCenter) {
      return { valid: false, error: 'First word must cover the center star' };
    }
    // First move must form a word (at least 2 tiles)
    if (placements.length < 2) {
      return { valid: false, error: 'First word must be at least 2 letters long' };
    }
  } else {
    // Subsequent moves: at least one tile must be adjacent to an existing tile
    const touchesExisting = placements.some(p =>
      hasAdjacentTile(boardState.cells, p.row, p.col)
    );
    if (!touchesExisting) {
      return { valid: false, error: 'New tiles must connect to existing tiles on the board' };
    }
  }

  // 7. Build the board with new tiles and check all formed words
  const testCells = boardState.cells.map(row => [...row]);
  for (const p of placements) {
    const value = p.isBlank ? 0 : getTileValue(p.letter);
    testCells[p.row][p.col] = {
      letter: p.letter.toUpperCase(),
      value,
      isBlank: p.isBlank,
    } as PlacedTile;
  }

  const formedWords = findFormedWords(testCells, placements);

  if (formedWords.length === 0) {
    return { valid: false, error: 'No valid words formed' };
  }

  // 8. Check all formed words are in the dictionary
  for (const fw of formedWords) {
    if (!isValidWord(fw.word)) {
      return { valid: false, error: `"${fw.word}" is not a valid word` };
    }
  }

  return { valid: true };
}

/**
 * Validate a tile exchange.
 */
export function validateExchange(
  boardState: ScrabbleBoardState,
  tilesToExchange: string[],
  playerRack: string[]
): ValidationResult {
  if (tilesToExchange.length === 0) {
    return { valid: false, error: 'You must select at least one tile to exchange' };
  }

  // Must have enough tiles in the bag (at least 7)
  if (boardState.tileBag.length < 7) {
    return { valid: false, error: 'Not enough tiles in the bag to exchange (need at least 7)' };
  }

  // Check tiles are in rack
  const rackCopy = [...playerRack];
  for (const tile of tilesToExchange) {
    const idx = rackCopy.indexOf(tile);
    if (idx === -1) {
      return { valid: false, error: `You don't have the tile "${tile}" in your rack` };
    }
    rackCopy.splice(idx, 1);
  }

  return { valid: true };
}
