// ============================================================================
// Scrabble tile distribution and point values
// Standard English Scrabble: 100 tiles total
// ============================================================================

import { TileLetter } from './types';

interface TileConfig {
  count: number;
  value: number;
}

/** Standard English Scrabble tile distribution */
export const TILE_DISTRIBUTION: Record<string, TileConfig> = {
  A: { count: 9, value: 1 },
  B: { count: 2, value: 3 },
  C: { count: 2, value: 3 },
  D: { count: 4, value: 2 },
  E: { count: 12, value: 1 },
  F: { count: 2, value: 4 },
  G: { count: 3, value: 2 },
  H: { count: 2, value: 4 },
  I: { count: 9, value: 1 },
  J: { count: 1, value: 8 },
  K: { count: 1, value: 5 },
  L: { count: 4, value: 1 },
  M: { count: 2, value: 3 },
  N: { count: 6, value: 1 },
  O: { count: 8, value: 1 },
  P: { count: 2, value: 3 },
  Q: { count: 1, value: 10 },
  R: { count: 6, value: 1 },
  S: { count: 4, value: 1 },
  T: { count: 6, value: 1 },
  U: { count: 4, value: 1 },
  V: { count: 2, value: 4 },
  W: { count: 2, value: 4 },
  X: { count: 1, value: 8 },
  Y: { count: 2, value: 4 },
  Z: { count: 1, value: 10 },
  _: { count: 2, value: 0 }, // blank tiles
};

/** Get the point value of a letter (0 for blanks) */
export function getTileValue(letter: string): number {
  if (letter === '_') return 0;
  return TILE_DISTRIBUTION[letter.toUpperCase()]?.value ?? 0;
}

/** Create a full bag of 100 tiles (shuffled) */
export function createTileBag(): TileLetter[] {
  const bag: TileLetter[] = [];

  for (const [letter, config] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < config.count; i++) {
      bag.push(letter);
    }
  }

  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  return bag;
}

/**
 * Draw tiles from the bag to fill a rack up to the desired count.
 * Mutates the bag array (removes tiles from the end).
 * Returns the drawn tiles.
 */
export function drawTiles(bag: TileLetter[], count: number): TileLetter[] {
  const drawn: TileLetter[] = [];
  const toDraw = Math.min(count, bag.length);

  for (let i = 0; i < toDraw; i++) {
    drawn.push(bag.pop()!);
  }

  return drawn;
}

/**
 * Return tiles to the bag and reshuffle.
 * Mutates the bag array.
 */
export function returnTilesToBag(bag: TileLetter[], tiles: TileLetter[]): void {
  bag.push(...tiles);

  // Reshuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}
