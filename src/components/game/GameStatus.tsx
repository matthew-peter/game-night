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
  const isMyTurn = game.current_turn === playerRole;
  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const remaining = getRemainingAgentsPerPlayer(game);
  const inSuddenDeath = game.sudden_death || game.timer_tokens <= 0;
  
  const myRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
  const theirRemaining = playerRole === 'player1' ? remaining.player2 : remaining.player1;
  
  return (
    <div className="bg-white border-b px-4 py-3 shadow-sm">
      <div className="max-w-lg mx-auto">
        {/* Turn indicator */}
        <div className="text-center mb-3">
          <span
            className={cn(
              'inline-block px-4 py-1.5 rounded-full text-sm font-semibold',
              isMyTurn
                ? 'bg-green-100 text-green-800'
                : 'bg-stone-100 text-stone-600'
            )}
          >
            {isMyTurn ? 'Your Turn' : `${opponentName || 'Opponent'}'s Turn`}
          </span>
        </div>
        
        {/* Current clue */}
        {currentClue && (
          <div className="text-center mb-3 p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 uppercase tracking-wide">Current Clue</p>
            <p className="text-lg font-bold text-blue-900">
              {currentClue.clue_word}: {currentClue.clue_number}
            </p>
          </div>
        )}
        
        {/* Stats row */}
        <div className="flex items-center justify-between text-sm">
          {/* Timer tokens */}
          <div className="flex items-center gap-1">
            <span className="text-stone-500">Tokens:</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-3 h-3 rounded-full',
                    i < game.timer_tokens
                      ? 'bg-amber-500'
                      : 'bg-stone-200'
                  )}
                />
              ))}
            </div>
            {inSuddenDeath && (
              <span className="text-red-600 font-semibold ml-1 text-xs">
                SUDDEN DEATH
              </span>
            )}
          </div>
          
          {/* Agents found */}
          <div className="text-center">
            <span className="text-green-600 font-semibold">{agentsFound}</span>
            <span className="text-stone-400">/{totalAgents}</span>
            <span className="text-stone-500 ml-1">Agents</span>
          </div>
        </div>
        
        {/* Remaining per player */}
        <div className="flex justify-between mt-2 text-xs text-stone-500">
          <span>
            Your key: <span className="font-semibold text-green-600">{myRemaining}</span> left
          </span>
          <span>
            Their key: <span className="font-semibold text-green-600">{theirRemaining}</span> left
          </span>
        </div>
      </div>
    </div>
  );
}
