// ============================================================================
// So Clover — Game logic
// ============================================================================

import { KEYWORDS } from './words';
import {
  SoCloverBoardState,
  PlayerClover,
  CurrentGuess,
  ZONE_PAIRS,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Card dealing ────────────────────────────────────────────────────────────

/**
 * Generate keyword cards for a game. Each card has 2 words.
 * We need 4 cards per player + 1 decoy per player = 5 per player.
 * We generate a few extra to ensure variety.
 */
export function generateKeywordCards(
  playerCount: number
): [string, string][] {
  const cardsNeeded = playerCount * 5;
  const wordsNeeded = cardsNeeded * 2;

  const shuffled = shuffle(KEYWORDS).slice(0, wordsNeeded);
  const cards: [string, string][] = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    cards.push([shuffled[i], shuffled[i + 1]]);
  }
  return cards;
}

/**
 * Build the initial board state for a new So Clover game.
 */
export function createInitialBoardState(playerCount: number): SoCloverBoardState {
  const cards = generateKeywordCards(playerCount);

  const clovers: PlayerClover[] = [];
  let cardIdx = 0;

  for (let seat = 0; seat < playerCount; seat++) {
    const cardIndices = [cardIdx, cardIdx + 1, cardIdx + 2, cardIdx + 3];
    const decoyCardIndex = cardIdx + 4;
    cardIdx += 5;

    clovers.push({
      cardIndices,
      decoyCardIndex,
      clues: [null, null, null, null],
      cluesSubmitted: false,
      orientations: [true, true, true, true],
      score: null,
    });
  }

  const spectatorOrder = shuffle(
    Array.from({ length: playerCount }, (_, i) => i)
  );

  return {
    keywordCards: cards,
    clovers,
    spectatorOrder,
    currentSpectatorIdx: -1,
    currentGuess: null,
    roundScores: new Array(playerCount).fill(null),
  };
}

// ── Clue validation ─────────────────────────────────────────────────────────

/**
 * Validate that clues are legal: single word, not empty, not one of the
 * player's 8 keywords.
 */
export function validateClues(
  clues: string[],
  playerKeywords: string[]
): { valid: boolean; error?: string } {
  const normalizedKeywords = playerKeywords.map((w) => w.toLowerCase().trim());

  for (let i = 0; i < clues.length; i++) {
    const clue = clues[i]?.trim();
    if (!clue) {
      return { valid: false, error: `Clue ${i + 1} is empty` };
    }
    if (/\s/.test(clue)) {
      return { valid: false, error: `"${clue}" must be a single word` };
    }
    if (normalizedKeywords.includes(clue.toLowerCase())) {
      return {
        valid: false,
        error: `"${clue}" is one of your keywords — not allowed`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get all 8 keywords from a player's clover.
 */
export function getPlayerKeywords(
  boardState: SoCloverBoardState,
  seat: number
): string[] {
  const clover = boardState.clovers[seat];
  const keywords: string[] = [];
  for (const idx of clover.cardIndices) {
    keywords.push(...boardState.keywordCards[idx]);
  }
  return keywords;
}

// ── Pair computation ────────────────────────────────────────────────────────

/**
 * For a given zone, returns the two words that face it based on card
 * placements and orientations.
 *
 * Card positions in 2×2 grid:
 *   [0] [1]
 *   [2] [3]
 *
 * Zone adjacency (which two card positions touch each zone):
 *   zone 0 (top):    cards at pos 0, 1
 *   zone 1 (right):  cards at pos 1, 3
 *   zone 2 (bottom): cards at pos 2, 3
 *   zone 3 (left):   cards at pos 0, 2
 *
 * Each card position has two zones it touches. The orientation boolean
 * determines which word (index 0 or 1) faces which zone.
 *
 * For card at position P with orientation O:
 *   "first zone" = the zone listed first for that card in CARD_ZONE_MAP
 *   O = true  → word[0] faces first zone, word[1] faces second zone
 *   O = false → word[1] faces first zone, word[0] faces second zone
 */

const CARD_ZONE_MAP: Record<number, [number, number]> = {
  0: [0, 3], // card 0: top, left
  1: [0, 1], // card 1: top, right
  2: [3, 2], // card 2: left, bottom
  3: [1, 2], // card 3: right, bottom
};

/**
 * Given a card index in a position, and the zone we're asking about,
 * return which word of the card faces that zone.
 */
export function getWordFacingZone(
  card: [string, string],
  position: number,
  zone: number,
  orientation: boolean
): string {
  const [firstZone] = CARD_ZONE_MAP[position];
  const isFirstZone = zone === firstZone;

  if (orientation) {
    return isFirstZone ? card[0] : card[1];
  } else {
    return isFirstZone ? card[1] : card[0];
  }
}

/**
 * Get the two words facing a given zone based on current placements.
 */
export function getWordsForZone(
  cards: [string, string][],
  placements: (number | null)[],
  orientations: boolean[],
  zone: number
): [string | null, string | null] {
  const [pos1, pos2] = ZONE_PAIRS[zone];
  const cardIdx1 = placements[pos1];
  const cardIdx2 = placements[pos2];

  const word1 =
    cardIdx1 != null
      ? getWordFacingZone(cards[cardIdx1], pos1, zone, orientations[pos1])
      : null;
  const word2 =
    cardIdx2 != null
      ? getWordFacingZone(cards[cardIdx2], pos2, zone, orientations[pos2])
      : null;

  return [word1, word2];
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Compare a guess placement against the original clover.
 * Returns an array of 4 booleans — true if position is correct
 * (same card AND same orientation).
 */
export function checkPlacements(
  originalClover: PlayerClover,
  guessPlacements: (number | null)[],
  guessOrientations: boolean[]
): boolean[] {
  return originalClover.cardIndices.map((origCard, pos) => {
    const guessCard = guessPlacements[pos];
    if (guessCard !== origCard) return false;
    return guessOrientations[pos] === originalClover.orientations[pos];
  });
}

/**
 * Compute the score for a resolution round.
 * - First attempt, all 4 correct: 6 points
 * - Second attempt: 1 point per correct position (0–4)
 */
export function computeRoundScore(
  originalClover: PlayerClover,
  guess: CurrentGuess,
  guessPlacements: (number | null)[],
  guessOrientations: boolean[]
): number {
  const results = checkPlacements(originalClover, guessPlacements, guessOrientations);
  const correctCount = results.filter(Boolean).length;

  if (guess.attempt === 1) {
    return correctCount === 4 ? 6 : -1; // -1 signals "go to attempt 2"
  }

  return correctCount;
}

/**
 * Compute the final total score across all rounds.
 */
export function computeTotalScore(roundScores: (number | null)[]): number {
  return roundScores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
}

/**
 * Maximum possible score for a game with N players.
 */
export function maxPossibleScore(playerCount: number): number {
  return playerCount * 6;
}

// ── Phase transitions ───────────────────────────────────────────────────────

/**
 * Check if all players have submitted their clues.
 */
export function allCluesSubmitted(boardState: SoCloverBoardState): boolean {
  return boardState.clovers.every((c) => c.cluesSubmitted);
}

/**
 * Check if all resolution rounds are complete.
 */
export function allRoundsComplete(boardState: SoCloverBoardState): boolean {
  return (
    boardState.currentSpectatorIdx >= boardState.spectatorOrder.length - 1 &&
    boardState.roundScores[boardState.spectatorOrder[boardState.currentSpectatorIdx]] != null
  );
}

/**
 * Get the current spectator's seat number, or null if in clue_writing phase.
 */
export function getCurrentSpectatorSeat(
  boardState: SoCloverBoardState
): number | null {
  if (boardState.currentSpectatorIdx < 0) return null;
  return boardState.spectatorOrder[boardState.currentSpectatorIdx] ?? null;
}

/**
 * Get the 5 card indices available for guessing during a resolution round:
 * the 4 real cards + 1 decoy, shuffled.
 */
export function getResolutionCardIndices(
  boardState: SoCloverBoardState,
  spectatorSeat: number
): number[] {
  const clover = boardState.clovers[spectatorSeat];
  return shuffle([...clover.cardIndices, clover.decoyCardIndex]);
}

/**
 * Prepare a fresh CurrentGuess for a new resolution round.
 */
export function createFreshGuess(): CurrentGuess {
  return {
    placements: [null, null, null, null],
    orientations: [true, true, true, true],
    attempt: 1,
    firstAttemptResults: null,
  };
}
