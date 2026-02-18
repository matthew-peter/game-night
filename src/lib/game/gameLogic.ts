import { Game, KeyCard, BoardState, CardType, Seat } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from './keyGenerator';

/**
 * Determines if a word is an agent from any player's perspective
 */
export function isAgentForAnySide(wordIndex: number, keyCard: KeyCard): boolean {
  return keyCard.some((side) => side.agents.includes(wordIndex));
}

/**
 * Counts agents found so far
 */
export function countAgentsFound(boardState: BoardState): number {
  return Object.values(boardState.revealed).filter(r => r.type === 'agent').length;
}

/**
 * Counts total agents needed (unique agents across all key card sides)
 */
export function countTotalAgentsNeeded(keyCard: KeyCard): number {
  const allAgents = new Set(keyCard.flatMap((side) => side.agents));
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
  return game.sudden_death === true;
}

/**
 * Processes a guess and returns the result.
 *
 * @param game         Current game state
 * @param wordIndex    Index of the guessed word (0-24)
 * @param guessingSeat Seat of the player guessing
 */
export function processGuess(
  game: Game,
  wordIndex: number,
  guessingSeat: Seat
): {
  cardType: CardType;
  newBoardState: BoardState;
  gameOver: boolean;
  won: boolean;
  turnEnds: boolean;
} {
  const word = game.words[wordIndex];
  const keyCard = game.key_card;
  
  // Guard: if already revealed as agent, don't re-process
  const existingReveal = game.board_state.revealed[word];
  if (existingReveal && existingReveal.type === 'agent') {
    return {
      cardType: 'agent',
      newBoardState: game.board_state,
      gameOver: false,
      won: false,
      turnEnds: false,
    };
  }
  
  // The card type is determined by the CLUE GIVER's key.
  // In Codenames Duet, the clue giver is current_turn.
  // The guesser sees the OTHER player's key (i.e., the clue giver's).
  const clueGiverSeat = game.current_turn;
  const cardType = getCardTypeForPlayer(wordIndex, keyCard, clueGiverSeat);
  
  // Update board state
  const newBoardState: BoardState = {
    ...game.board_state,
    revealed: {
      ...game.board_state.revealed,
      [word]: {
        type: cardType,
        guessedBy: guessingSeat,
      },
    },
  };
  
  // Check game over conditions
  const assassinHit = cardType === 'assassin';
  
  const agentsFound = countAgentsFound(newBoardState);
  const totalNeeded = countTotalAgentsNeeded(keyCard);
  const won = agentsFound >= totalNeeded;
  
  // Only the explicit flag means sudden death — timer_tokens=0 alone means
  // "last clue turn" where the guesser still gets their normal turn.
  const suddenDeath = game.sudden_death === true;
  const suddenDeathLoss = suddenDeath && cardType === 'bystander';
  
  const gameOver = assassinHit || won || suddenDeathLoss;
  const turnEnds = cardType !== 'agent';
  
  return {
    cardType,
    newBoardState,
    gameOver,
    won: won && !assassinHit,
    turnEnds,
  };
}

/**
 * Calculates remaining agents for each seat.
 * Returns an array indexed by seat.
 *
 * An agent is "remaining" if it hasn't been revealed as agent yet.
 */
export function getRemainingAgentsPerSeat(game: Game): number[] {
  const revealed = game.board_state.revealed;
  
  const revealedByIndex = new Map<number, { type: CardType }>();
  for (const word of Object.keys(revealed)) {
    const wordIndex = game.words.indexOf(word);
    if (wordIndex !== -1) {
      revealedByIndex.set(wordIndex, revealed[word]);
    }
  }
  
  return game.key_card.map((side) =>
    side.agents.filter((idx) => {
      const rev = revealedByIndex.get(idx);
      if (!rev) return true;           // not revealed at all
      return rev.type !== 'agent';     // revealed but not as agent
    }).length
  );
}

/**
 * Checks if a seat has any unrevealed agents on their key to clue about.
 */
export function hasAgentsToClue(game: Game, seat: Seat): boolean {
  const remaining = getRemainingAgentsPerSeat(game);
  return (remaining[seat] ?? 0) > 0;
}

/**
 * Gets the next seat in turn order.
 * For a 2-player game: 0 -> 1 -> 0.
 * For N players: cycles through 0..N-1.
 */
export function getNextSeat(currentSeat: Seat, playerCount: number = 2): Seat {
  return (currentSeat + 1) % playerCount;
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
