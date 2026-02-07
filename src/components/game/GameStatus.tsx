'use client';

import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded, getRemainingAgentsPerPlayer } from '@/lib/game/gameLogic';
import { cn } from '@/lib/utils';
import { TappableClueWord } from './TappableClueWord';
import { Reactions } from './Reactions';

interface GameStatusProps {
  game: Game;
  playerRole: CurrentTurn;
  opponentName?: string;
  currentClue?: Move | null;
  guessCount?: number;
  userId?: string;
}

export function GameStatus({ game, playerRole, opponentName, currentClue, guessCount = 0, userId }: GameStatusProps) {
  const isClueGiver = game.current_turn === playerRole;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';
  const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;
  
  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const remaining = getRemainingAgentsPerPlayer(game);
  
  // remaining.player1 = light green cards on player1's board = cards player2 needs to guess
  // remaining.player2 = light green cards on player2's board = cards player1 needs to guess
  // "They need to find" = light green on MY board
  // "I need to find" = light green on THEIR board
  const myRemaining = playerRole === 'player1' ? remaining.player2 : remaining.player1;
  const theirRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
  
  // Simplified status logic:
  // - My turn to give clue: I'm clue giver (current_turn) AND phase is clue
  // - My turn to guess: I'm NOT clue giver AND phase is guess
  // - Waiting for them to give clue: I'm NOT clue giver AND phase is clue
  // - Waiting for them to guess: I'm clue giver AND phase is guess
  // - Sudden death: only guessing allowed
  
  let statusText = '';
  let isActive = false;
  
  if (inSuddenDeath) {
    // In sudden death, it's always guess phase
    if (isGuessPhase && !isClueGiver) {
      statusText = '💀 SUDDEN DEATH - GUESS!';
      isActive = true;
    } else {
      statusText = `💀 ${opponentName || 'Partner'} guessing...`;
    }
  } else if (isClueGiver) {
    if (isCluePhase) {
      statusText = '⚡ GIVE A CLUE';
      isActive = true;
    } else {
      statusText = `${opponentName || 'Partner'} guessing...`;
    }
  } else {
    if (isGuessPhase) {
      statusText = '⚡ YOUR TURN TO GUESS';
      isActive = true;
    } else {
      statusText = `${opponentName || 'Partner'} giving clue...`;
    }
  }
  
  return (
    <div className="bg-stone-700 px-3 py-2">
      <div className="max-w-md mx-auto space-y-2">
        {/* Row 1: Turn + Timer + Score */}
        <div className="flex items-center justify-between">
          {/* Turn indicator */}
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-bold',
            isActive ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
          )}>
            {statusText}
          </div>
          
          {/* Timer + Score + Reactions compact */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className={cn(
                'w-2 h-2 rounded-full',
                game.timer_tokens > 0 ? 'bg-amber-400' : 'bg-red-500'
              )} />
              <span className={cn(
                'text-xs font-bold',
                game.timer_tokens > 0 ? 'text-amber-400' : 'text-red-400'
              )}>{game.timer_tokens}</span>
            </div>
            <div className="text-xs text-white">
              <span className="text-emerald-400 font-bold">{agentsFound}</span>
              <span className="text-stone-400">/{totalAgents}</span>
            </div>
            {userId && (
              <div className="relative">
                <Reactions gameId={game.id} playerId={userId} compact />
              </div>
            )}
          </div>
        </div>
        
        {/* Row 2: Current clue OR remaining counts */}
        {currentClue ? (
          <div className="flex items-center justify-center gap-2 py-1 bg-stone-800 rounded">
            <span className="text-stone-400 text-xs">CLUE:</span>
            <TappableClueWord word={currentClue.clue_word || ''} className="text-white font-black text-lg" />
            <span className="text-amber-400 font-bold">{currentClue.clue_number}</span>
            {guessCount > 0 && (
              <span className="text-stone-400 text-xs">• {guessCount} guessed</span>
            )}
          </div>
        ) : (
          <div className="flex justify-center text-xs text-stone-300">
            <span>{opponentName || 'They'}: <span className="text-emerald-400 font-bold">{theirRemaining}</span> to find</span>
          </div>
        )}
      </div>
    </div>
  );
}
