import { Game, KeyCard, BoardState, CardType, CurrentTurn } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from './keyGenerator';

/**
 * Determines if a word is an agent from either player's perspective
 */
export function isAgentForEitherPlayer(wordIndex: number, keyCard: KeyCard): boolean {
  return (
    keyCard.player1.agents.includes(wordIndex) ||
    keyCard.player2.agents.includes(wordIndex)
  );
}

/**
 * Counts agents found so far
 */
export function countAgentsFound(boardState: BoardState): number {
  return Object.values(boardState.revealed).filter(r => r.type === 'agent').length;
}

/**
 * Counts total agents needed (unique agents across both key cards)
 */
export function countTotalAgentsNeeded(keyCard: KeyCard): number {
  const allAgents = new Set([...keyCard.player1.agents, ...keyCard.player2.agents]);
  return allAgents.size;
}

/**
 * Checks if the game is won
 */
export function checkWin(game: Game): boolean {
  const agentsFound = countAgentsFound(game.board_state);
  const totalNeeded = countTotalAgentsNeeded(game.key_card);
  return agentsFound >= totalNeeded;
}

/**
 * Checks if an assassin was hit
 */
export function checkAssassinHit(boardState: BoardState): boolean {
  return Object.values(boardState.revealed).some(r => r.type === 'assassin');
}

/**
 * Checks if the game is in sudden death (no tokens left)
 */
export function isInSuddenDeath(game: Game): boolean {
  return game.sudden_death || game.timer_tokens <= 0;
}

/**
 * Processes a guess and returns the result
 */
export function processGuess(
  game: Game,
  wordIndex: number,
  guessingPlayer: CurrentTurn
): {
  cardType: CardType;
  newBoardState: BoardState;
  gameOver: boolean;
  won: boolean;
  turnEnds: boolean;
} {
  const word = game.words[wordIndex];
  const keyCard = game.key_card;
  
  // Determine what this card is based on the CURRENT player's key
  // In Duet, the guesser looks at THEIR OWN key to see what their partner knows
  // But the card type is determined by the clue giver's perspective
  const clueGiver = guessingPlayer === 'player1' ? 'player2' : 'player1';
  const cardType = getCardTypeForPlayer(wordIndex, keyCard, clueGiver);
  
  // Update board state
  const newBoardState: BoardState = {
    revealed: {
      ...game.board_state.revealed,
      [word]: {
        type: cardType,
        guessedBy: guessingPlayer
      }
    }
  };
  
  // Check game over conditions
  const assassinHit = cardType === 'assassin';
  
  // Check if won (all agents found)
  const agentsFound = countAgentsFound(newBoardState);
  const totalNeeded = countTotalAgentsNeeded(keyCard);
  const won = agentsFound >= totalNeeded;
  
  // In sudden death, hitting a bystander is also game over
  const suddenDeath = game.sudden_death || game.timer_tokens <= 0;
  const suddenDeathLoss = suddenDeath && cardType === 'bystander';
  
  const gameOver = assassinHit || won || suddenDeathLoss;
  const turnEnds = cardType !== 'agent'; // Turn ends on bystander or assassin
  
  return {
    cardType,
    newBoardState,
    gameOver,
    won: won && !assassinHit,
    turnEnds
  };
}

/**
 * Calculates remaining agents for each player
 * An agent is "found" when it has been revealed and the card is in that player's agents list.
 * For shared agents (on both keys), revealing it counts for both players.
 */
export function getRemainingAgentsPerPlayer(game: Game): {
  player1: number;
  player2: number;
} {
  const revealed = game.board_state.revealed;
  
  // Build a map of word -> revealed info, keyed by index
  const revealedByIndex = new Map<number, { type: CardType; guessedBy: string }>();
  for (const word of Object.keys(revealed)) {
    const wordIndex = game.words.indexOf(word);
    if (wordIndex !== -1) {
      revealedByIndex.set(wordIndex, revealed[word]);
    }
  }
  
  // Count remaining agents for each player
  // An agent is "remaining" if:
  // 1. It's not revealed at all, OR
  // 2. It was revealed but NOT as an agent (meaning it's still "light green" on this player's board)
  const player1Remaining = game.key_card.player1.agents.filter(idx => {
    const rev = revealedByIndex.get(idx);
    if (!rev) return true; // not revealed
    return rev.type !== 'agent'; // revealed but not as agent = still counts as remaining for display
  }).length;
  
  const player2Remaining = game.key_card.player2.agents.filter(idx => {
    const rev = revealedByIndex.get(idx);
    if (!rev) return true;
    return rev.type !== 'agent';
  }).length;
  
  return { 
    player1: player1Remaining, 
    player2: player2Remaining 
  };
}

/**
 * Gets the next turn
 */
export function getNextTurn(currentTurn: CurrentTurn): CurrentTurn {
  return currentTurn === 'player1' ? 'player2' : 'player1';
}

/**
 * Checks if a word has already been revealed
 */
export function isWordRevealed(word: string, boardState: BoardState): boolean {
  return word in boardState.revealed;
}

/**
 * Get all unrevealed words
 */
export function getUnrevealedWords(words: string[], boardState: BoardState): string[] {
  return words.filter(word => !isWordRevealed(word, boardState));
}
