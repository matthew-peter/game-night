// ============================================================================
// So Clover — Type definitions
//
// Each keyword card has 4 words, one on each edge (top, right, bottom, left).
// Cards can be rotated 0°, 90°, 180°, or 270° clockwise (represented as 0–3).
// ============================================================================

/**
 * A keyword card with 4 words, one per edge.
 * Index 0 = top, 1 = right, 2 = bottom, 3 = left (at rotation 0).
 */
export type KeywordCardWords = [string, string, string, string];

/** Edge indices */
export const EDGE_TOP = 0;
export const EDGE_RIGHT = 1;
export const EDGE_BOTTOM = 2;
export const EDGE_LEFT = 3;

/**
 * Card positions in the 2×2 clover grid:
 *   [0] [1]
 *   [2] [3]
 *
 * Clue zones (clockwise from top):
 *   zone 0 (TOP):    between cards 0 and 1
 *   zone 1 (RIGHT):  between cards 1 and 3
 *   zone 2 (BOTTOM): between cards 2 and 3
 *   zone 3 (LEFT):   between cards 0 and 2
 *
 * Clue zones sit on the OUTER perimeter of the clover. Each zone
 * connects the outward-facing edges of its two adjacent cards:
 *   TOP:    card 0's top edge    + card 1's top edge
 *   RIGHT:  card 1's right edge  + card 3's right edge
 *   BOTTOM: card 2's bottom edge + card 3's bottom edge
 *   LEFT:   card 0's left edge   + card 2's left edge
 */
export const ZONE_CONTRIBUTIONS: { pos: number; edge: number }[][] = [
  [{ pos: 0, edge: EDGE_TOP }, { pos: 1, edge: EDGE_TOP }],         // TOP
  [{ pos: 1, edge: EDGE_RIGHT }, { pos: 3, edge: EDGE_RIGHT }],     // RIGHT
  [{ pos: 2, edge: EDGE_BOTTOM }, { pos: 3, edge: EDGE_BOTTOM }],   // BOTTOM
  [{ pos: 0, edge: EDGE_LEFT }, { pos: 2, edge: EDGE_LEFT }],       // LEFT
];

/**
 * Get the word at a given edge of a card after applying rotation.
 *
 * When a card rotates r steps clockwise, each word shifts:
 *   the word originally at position p is now at position (p + r) % 4
 * So to find what's at edge e after rotation r:
 *   words[(e - r + 4) % 4]
 */
export function getWordAtEdge(
  words: KeywordCardWords,
  rotation: number,
  edge: number
): string {
  return words[((edge - rotation) % 4 + 4) % 4];
}

/**
 * Get all 4 edge words after rotation, in display order [top, right, bottom, left].
 */
export function getRotatedWords(
  words: KeywordCardWords,
  rotation: number
): [string, string, string, string] {
  return [
    getWordAtEdge(words, rotation, EDGE_TOP),
    getWordAtEdge(words, rotation, EDGE_RIGHT),
    getWordAtEdge(words, rotation, EDGE_BOTTOM),
    getWordAtEdge(words, rotation, EDGE_LEFT),
  ];
}

export interface PlayerClover {
  cardIndices: number[];       // 4 indices into keywordCards
  decoyCardIndex: number;      // 5th decoy card index
  clues: (string | null)[];    // 4 clues, indexed by zone (top, right, bottom, left)
  cluesSubmitted: boolean;
  rotations: number[];         // 4 rotation values (0–3), one per card position
  score: number | null;
}

export interface CurrentGuess {
  placements: (number | null)[]; // 4 positions → card index or null
  rotations: number[];           // rotation per position (0–3)
  attempt: 1 | 2;
  firstAttemptResults: boolean[] | null;
}

export interface SoCloverBoardState {
  keywordCards: KeywordCardWords[];  // all keyword cards generated for this game
  clovers: PlayerClover[];           // indexed by seat

  spectatorOrder: number[];          // seat order for resolution rounds
  currentSpectatorIdx: number;       // -1 = clue_writing phase, 0+ = resolution round index

  currentGuess: CurrentGuess | null;
  roundScores: (number | null)[];    // score per spectator round
}

export type SoCloverMoveType = 'submit_clues' | 'place_cards' | 'submit_guess';

export interface SubmitCluesData {
  clues: string[];
}

export interface PlaceCardsData {
  placements: (number | null)[];
  rotations: number[];
}

export interface SubmitGuessData {
  placements: (number | null)[];
  rotations: number[];
}
