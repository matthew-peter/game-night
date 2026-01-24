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
 * A player's agent is "found" when it was revealed AS an agent on their key card
 * (i.e., when the other player was guessing and it was their agent, or when this player
 * was guessing and it happened to also be their agent)
 */
export function getRemainingAgentsPerPlayer(game: Game): {
  player1: number;
  player2: number;
} {
  const revealed = game.board_state.revealed;
  
  // For each player, count how many of their agents have been revealed
  // An agent is "found" for a player when that card index has been revealed
  // AND it was revealed as 'agent' type (meaning the clue giver had it as agent)
  // OR the card is in their agents list and has been revealed at all
  
  // Actually in Duet: your agents are found when your partner guesses them correctly
  // Your partner gives you clues for YOUR agents (from their key, which shows your agents)
  // So player1's remaining = player1's agents that haven't been guessed yet
  
  let player1Found = 0;
  let player2Found = 0;
  
  for (const [word, revealInfo] of Object.entries(revealed)) {
    const wordIndex = game.words.indexOf(word);
    if (wordIndex === -1) continue;
    
    // Check if this was an agent for player1's key (meaning player2 needs to find it)
    if (game.key_card.player1.agents.includes(wordIndex)) {
      // Player1's agent - player2 was trying to find this
      // It's found if it was revealed as 'agent' by player2 guessing
      if (revealInfo.guessedBy === 'player2' && revealInfo.type === 'agent') {
        player1Found++;
      }
    }
    
    // Check if this was an agent for player2's key (meaning player1 needs to find it)
    if (game.key_card.player2.agents.includes(wordIndex)) {
      // Player2's agent - player1 was trying to find this
      // It's found if it was revealed as 'agent' by player1 guessing
      if (revealInfo.guessedBy === 'player1' && revealInfo.type === 'agent') {
        player2Found++;
      }
    }
  }
  
  const player1Total = game.key_card.player1.agents.length;
  const player2Total = game.key_card.player2.agents.length;
  
  return { 
    player1: player1Total - player1Found, 
    player2: player2Total - player2Found 
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
