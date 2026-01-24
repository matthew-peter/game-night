'use client';

import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded, getRemainingAgentsPerPlayer } from '@/lib/game/gameLogic';
import { cn } from '@/lib/utils';

interface GameStatusProps {
  game: Game;
  playerRole: CurrentTurn;
  opponentName?: string;
  currentClue?: Move | null;
  guessCount?: number;
}

export function GameStatus({ game, playerRole, opponentName, currentClue, guessCount = 0 }: GameStatusProps) {
  const isClueGiver = game.current_turn === playerRole;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';
  
  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const remaining = getRemainingAgentsPerPlayer(game);
  
  const myRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
  const theirRemaining = playerRole === 'player1' ? remaining.player2 : remaining.player1;
  
  // Determine what to show
  const myAction = isClueGiver && isCluePhase;
  const theirGuessing = isClueGiver && isGuessPhase;
  const theirCluing = !isClueGiver && isCluePhase;
  const myGuessing = !isClueGiver && isGuessPhase;
  
  let statusText = '';
  let isActive = false;
  if (myAction) {
    statusText = '⚡ GIVE A CLUE';
    isActive = true;
  } else if (myGuessing) {
    statusText = '⚡ YOUR GUESS';
    isActive = true;
  } else if (theirGuessing) {
    statusText = `${opponentName || 'Partner'} guessing...`;
  } else if (theirCluing) {
    statusText = `${opponentName || 'Partner'} giving clue...`;
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
          
          {/* Timer + Score compact */}
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={cn(
                  'w-2 h-2 rounded-full',
                  i < game.timer_tokens ? 'bg-amber-400' : 'bg-stone-500'
                )} />
              ))}
            </div>
            <div className="text-xs text-white">
              <span className="text-emerald-400 font-bold">{agentsFound}</span>
              <span className="text-stone-400">/{totalAgents}</span>
            </div>
          </div>
        </div>
        
        {/* Row 2: Current clue OR remaining counts */}
        {currentClue ? (
          <div className="flex items-center justify-center gap-2 py-1 bg-stone-800 rounded">
            <span className="text-stone-400 text-xs">CLUE:</span>
            <span className="text-white font-black text-lg">{currentClue.clue_word}</span>
            <span className="text-amber-400 font-bold">{currentClue.clue_number}</span>
            {guessCount > 0 && (
              <span className="text-stone-400 text-xs">• {guessCount} guessed</span>
            )}
          </div>
        ) : (
          <div className="flex justify-between text-xs text-stone-300">
            <span>You: <span className="text-emerald-400 font-bold">{myRemaining}</span> to find</span>
            <span>{opponentName || 'They'}: <span className="text-emerald-400 font-bold">{theirRemaining}</span> to find</span>
          </div>
        )}
      </div>
    </div>
  );
}
