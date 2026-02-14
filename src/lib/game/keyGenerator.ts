import { KeyCard, KeyCardSide, CardType, Seat } from '@/lib/supabase/types';

/**
 * Generates a dual-sided key card for Codenames Duet.
 * Returns an array of two KeyCardSides indexed by seat.
 *
 * Rules:
 * - Each side has 9 agents and 3 assassins
 * - 3 agents overlap (green on both sides)
 * - 1 assassin overlaps (black on both sides)
 * - 1 assassin on each side is an agent on the other side
 * - 1 assassin on each side is a bystander on the other side
 */
export function generateKeyCard(): KeyCard {
  const indices = Array.from({ length: 25 }, (_, i) => i);
  shuffleArray(indices);

  let currentIndex = 0;

  // 3 shared agents (green on both sides)
  const sharedAgents = indices.slice(currentIndex, currentIndex + 3);
  currentIndex += 3;

  // 1 shared assassin (black on both sides)
  const sharedAssassin = indices.slice(currentIndex, currentIndex + 1);
  currentIndex += 1;

  // Seat 0's exclusive agents (6 more to total 9)
  const seat0ExclusiveAgents = indices.slice(currentIndex, currentIndex + 6);
  currentIndex += 6;

  // Seat 1's exclusive agents (6 more to total 9)
  const seat1ExclusiveAgents = indices.slice(currentIndex, currentIndex + 6);
  currentIndex += 6;

  // Seat 0's assassin that is an agent for Seat 1
  const seat0AssassinThatIsSeat1Agent = seat1ExclusiveAgents[0];

  // Seat 1's assassin that is an agent for Seat 0
  const seat1AssassinThatIsSeat0Agent = seat0ExclusiveAgents[0];

  // Seat 0's assassin that is bystander for Seat 1
  const seat0AssassinBystander = indices[currentIndex];
  currentIndex += 1;

  // Seat 1's assassin that is bystander for Seat 0
  const seat1AssassinBystander = indices[currentIndex];
  currentIndex += 1;

  const side0: KeyCardSide = {
    agents: [...sharedAgents, ...seat0ExclusiveAgents],
    assassins: [
      sharedAssassin[0],
      seat0AssassinThatIsSeat1Agent,
      seat0AssassinBystander,
    ],
  };

  const side1: KeyCardSide = {
    agents: [...sharedAgents, ...seat1ExclusiveAgents],
    assassins: [
      sharedAssassin[0],
      seat1AssassinThatIsSeat0Agent,
      seat1AssassinBystander,
    ],
  };

  return [side0, side1];
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Get what a card looks like from a specific seat's perspective.
 */
export function getCardTypeForPlayer(
  wordIndex: number,
  keyCard: KeyCard,
  seat: Seat
): CardType {
  const side = keyCard[seat];
  if (!side) return 'bystander';

  if (side.agents.includes(wordIndex)) return 'agent';
  if (side.assassins.includes(wordIndex)) return 'assassin';
  return 'bystander';
}

/**
 * Count total unique agents across all sides (should be 15 for Codenames Duet)
 */
export function countTotalAgents(keyCard: KeyCard): number {
  const allAgents = new Set(keyCard.flatMap((side) => side.agents));
  return allAgents.size;
}
