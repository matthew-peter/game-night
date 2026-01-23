import { KeyCard, KeyCardSide } from '@/lib/supabase/types';

/**
 * Generates a dual-sided key card for Codenames Duet
 * 
 * Rules:
 * - Each side has 9 agents and 3 assassins
 * - 3 agents overlap (green on both sides)
 * - 1 assassin overlaps (black on both sides)
 * - 1 assassin on each side is an agent on the other side
 * - 1 assassin on each side is a bystander on the other side
 */
export function generateKeyCard(): KeyCard {
  // Shuffle indices 0-24
  const indices = Array.from({ length: 25 }, (_, i) => i);
  shuffleArray(indices);
  
  let currentIndex = 0;
  
  // 3 shared agents (green on both sides)
  const sharedAgents = indices.slice(currentIndex, currentIndex + 3);
  currentIndex += 3;
  
  // 1 shared assassin (black on both sides)
  const sharedAssassin = indices.slice(currentIndex, currentIndex + 1);
  currentIndex += 1;
  
  // Player 1's exclusive agents (6 more to total 9)
  const player1ExclusiveAgents = indices.slice(currentIndex, currentIndex + 6);
  currentIndex += 6;
  
  // Player 2's exclusive agents (6 more to total 9)
  const player2ExclusiveAgents = indices.slice(currentIndex, currentIndex + 6);
  currentIndex += 6;
  
  // Player 1's assassin that is an agent for Player 2
  // We take one from player2's exclusive agents
  const player1AssassinThatIsPlayer2Agent = player2ExclusiveAgents[0];
  
  // Player 2's assassin that is an agent for Player 1
  // We take one from player1's exclusive agents
  const player2AssassinThatIsPlayer1Agent = player1ExclusiveAgents[0];
  
  // Player 1's assassin that is bystander for Player 2
  const player1AssassinBystander = indices[currentIndex];
  currentIndex += 1;
  
  // Player 2's assassin that is bystander for Player 1
  const player2AssassinBystander = indices[currentIndex];
  currentIndex += 1;
  
  // Build the key cards
  const player1: KeyCardSide = {
    agents: [...sharedAgents, ...player1ExclusiveAgents],
    assassins: [
      sharedAssassin[0],
      player1AssassinThatIsPlayer2Agent,
      player1AssassinBystander
    ]
  };
  
  const player2: KeyCardSide = {
    agents: [...sharedAgents, ...player2ExclusiveAgents],
    assassins: [
      sharedAssassin[0],
      player2AssassinThatIsPlayer1Agent,
      player2AssassinBystander
    ]
  };
  
  return { player1, player2 };
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
 * Get what a card looks like from a player's perspective
 */
export function getCardTypeForPlayer(
  wordIndex: number,
  keyCard: KeyCard,
  player: 'player1' | 'player2'
): 'agent' | 'assassin' | 'bystander' {
  const side = keyCard[player];
  
  if (side.agents.includes(wordIndex)) {
    return 'agent';
  }
  if (side.assassins.includes(wordIndex)) {
    return 'assassin';
  }
  return 'bystander';
}

/**
 * Count total unique agents (should be 15 for Codenames Duet)
 */
export function countTotalAgents(keyCard: KeyCard): number {
  const allAgents = new Set([...keyCard.player1.agents, ...keyCard.player2.agents]);
  return allAgents.size;
}
