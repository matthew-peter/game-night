// ============================================================================
// So Clover — Type definitions
// ============================================================================

export interface SoCloverKeywordCard {
  words: [string, string];
}

/**
 * Clue zones are ordered: top, right, bottom, left (clockwise from top).
 *
 * Card positions in the 2×2 clover grid:
 *   [0] [1]
 *   [2] [3]
 *
 * Zone adjacency:
 *   top    → cards 0, 1
 *   right  → cards 1, 3
 *   bottom → cards 2, 3
 *   left   → cards 0, 2
 */
export const ZONE_PAIRS: [number, number][] = [
  [0, 1], // top
  [1, 3], // right
  [2, 3], // bottom
  [0, 2], // left
];

/**
 * For each card position, which word index (0 or 1) faces each zone.
 * orientations[pos] = true means word[0] faces the "first" zone for that position.
 *
 * Card 0 participates in zones: top (idx 0), left (idx 3)
 * Card 1 participates in zones: top (idx 0), right (idx 1)
 * Card 2 participates in zones: bottom (idx 2), left (idx 3)
 * Card 3 participates in zones: right (idx 1), bottom (idx 2)
 *
 * When orientation is true:
 *   Card 0: word[0] → top,  word[1] → left
 *   Card 1: word[0] → top,  word[1] → right
 *   Card 2: word[0] → left, word[1] → bottom
 *   Card 3: word[0] → right, word[1] → bottom
 */
export interface PlayerClover {
  cardIndices: number[];       // 4 indices into keywordCards
  decoyCardIndex: number;      // 5th decoy card index
  clues: (string | null)[];    // 4 clues, indexed by zone (top, right, bottom, left)
  cluesSubmitted: boolean;
  orientations: boolean[];     // 4 booleans, one per card position
  score: number | null;
}

export interface CurrentGuess {
  placements: (number | null)[]; // 4 positions → card index or null
  orientations: boolean[];       // flip state per position (4 booleans)
  attempt: 1 | 2;
  firstAttemptResults: boolean[] | null; // which positions were correct on 1st attempt
}

export interface SoCloverBoardState {
  keywordCards: [string, string][]; // all keyword cards generated for this game
  clovers: PlayerClover[];          // indexed by seat

  spectatorOrder: number[];         // seat order for resolution rounds
  currentSpectatorIdx: number;      // -1 = clue_writing phase, 0+ = resolution round index

  currentGuess: CurrentGuess | null;
  roundScores: (number | null)[];   // score per spectator round
}

export type SoCloverMoveType = 'submit_clues' | 'place_cards' | 'submit_guess';

export interface SubmitCluesData {
  clues: string[];          // 4 clues
  orientations: boolean[];  // 4 booleans (player may have flipped cards while writing)
}

export interface PlaceCardsData {
  placements: (number | null)[]; // 4 positions → card index or null
  orientations: boolean[];       // 4 booleans for placed card orientations
}

export interface SubmitGuessData {
  placements: (number | null)[];
  orientations: boolean[];
}

/**
 * Given a card position and its orientation, returns [wordForFirstZone, wordForSecondZone].
 * "First zone" and "second zone" depend on the position — see ZONE_PAIRS.
 */
export function getWordsForPosition(
  card: [string, string],
  orientation: boolean
): [string, string] {
  return orientation ? [card[0], card[1]] : [card[1], card[0]];
}
