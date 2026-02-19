// ============================================================================
// So Clover — Game logic
// ============================================================================

import { KEYWORDS } from './words';
import {
  SoCloverBoardState,
  PlayerClover,
  CurrentGuess,
  KeywordCardWords,
  ZONE_CONTRIBUTIONS,
  getWordAtEdge,
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

function randomRotation(): number {
  return Math.floor(Math.random() * 4);
}

// ── Card dealing ────────────────────────────────────────────────────────────

/**
 * Generate keyword cards for a game. Each card has 4 words (one per edge).
 * We need 5 cards per player (4 real + 1 decoy).
 */
export function generateKeywordCards(
  playerCount: number
): KeywordCardWords[] {
  const cardsNeeded = playerCount * 5;
  const wordsNeeded = cardsNeeded * 4;

  const shuffled = shuffle(KEYWORDS).slice(0, wordsNeeded);
  const cards: KeywordCardWords[] = [];
  for (let i = 0; i + 3 < shuffled.length; i += 4) {
    cards.push([shuffled[i], shuffled[i + 1], shuffled[i + 2], shuffled[i + 3]]);
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
      rotations: [randomRotation(), randomRotation(), randomRotation(), randomRotation()],
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
 * player's 16 keywords (4 cards × 4 words).
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
 * Get all 16 keywords from a player's clover (4 cards × 4 words).
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

// ── Zone word computation ───────────────────────────────────────────────────

/**
 * Get the two words facing a given zone based on card placements and rotations.
 *
 * Each zone is defined by two (position, edge) pairs in ZONE_CONTRIBUTIONS.
 * For a card at a given position with a given rotation, the word at a
 * specific edge is: words[(edge - rotation + 4) % 4]
 */
export function getWordsForZone(
  cards: KeywordCardWords[],
  placements: (number | null)[],
  rotations: number[],
  zone: number
): [string | null, string | null] {
  const contributions = ZONE_CONTRIBUTIONS[zone];
  const results: (string | null)[] = [];

  for (const { pos, edge } of contributions) {
    const cardIdx = placements[pos];
    if (cardIdx == null) {
      results.push(null);
    } else {
      results.push(getWordAtEdge(cards[cardIdx], rotations[pos], edge));
    }
  }

  return [results[0], results[1]];
}

/**
 * Convenience: get zone words for a player's own clover (used in clue writing).
 */
export function getZoneWordsForClover(
  boardState: SoCloverBoardState,
  seat: number,
  zone: number
): [string, string] {
  const clover = boardState.clovers[seat];
  return getWordsForZone(
    boardState.keywordCards,
    clover.cardIndices,
    clover.rotations,
    zone
  ) as [string, string];
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Compare a guess placement against the original clover.
 * A position is correct if the same card is placed there AND the same
 * rotation is applied (so the same words face the same zones).
 */
export function checkPlacements(
  originalClover: PlayerClover,
  guessPlacements: (number | null)[],
  guessRotations: number[]
): boolean[] {
  return originalClover.cardIndices.map((origCard, pos) => {
    const guessCard = guessPlacements[pos];
    if (guessCard !== origCard) return false;
    return guessRotations[pos] === originalClover.rotations[pos];
  });
}

/**
 * Compute the score for a resolution round.
 * - First attempt, all 4 correct: 6 points
 * - Second attempt: 1 point per correct position (0–4)
 * Returns -1 to signal "go to attempt 2" on a failed first attempt.
 */
export function computeRoundScore(
  originalClover: PlayerClover,
  guess: CurrentGuess,
  guessPlacements: (number | null)[],
  guessRotations: number[]
): number {
  const results = checkPlacements(originalClover, guessPlacements, guessRotations);
  const correctCount = results.filter(Boolean).length;

  if (guess.attempt === 1) {
    return correctCount === 4 ? 6 : -1;
  }

  return correctCount;
}

export function computeTotalScore(roundScores: (number | null)[]): number {
  return roundScores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
}

export function maxPossibleScore(playerCount: number): number {
  return playerCount * 6;
}

// ── Phase transitions ───────────────────────────────────────────────────────

export function allCluesSubmitted(boardState: SoCloverBoardState): boolean {
  return boardState.clovers.every((c) => c.cluesSubmitted);
}

export function allRoundsComplete(boardState: SoCloverBoardState): boolean {
  return (
    boardState.currentSpectatorIdx >= boardState.spectatorOrder.length - 1 &&
    boardState.roundScores[boardState.spectatorOrder[boardState.currentSpectatorIdx]] != null
  );
}

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

export function createFreshGuess(): CurrentGuess {
  return {
    placements: [null, null, null, null],
    rotations: [0, 0, 0, 0],
    attempt: 1,
    firstAttemptResults: null,
  };
}
