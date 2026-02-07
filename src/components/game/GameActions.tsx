'use client';

import { Game, CurrentTurn } from '@/lib/supabase/types';
import { getRemainingAgentsPerPlayer } from '@/lib/game/gameLogic';
import { Button } from '@/components/ui/button';

interface GameActionsProps {
  game: Game;
  playerRole: CurrentTurn;
  onEndTurn: () => void;
  guessCount?: number;
}

export function GameActions({ 
  game, 
  playerRole, 
  onEndTurn,
  guessCount = 0
}: GameActionsProps) {
  const isClueGiver = game.current_turn === playerRole;
  const isGuesser = game.current_turn !== playerRole;
  const isGuessPhase = game.current_phase === 'guess';
  const isGuessing = isGuesser && isGuessPhase && game.status === 'playing';
  const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;
  
  // In sudden death, only show End Turn if the other player also has agents to find.
  // After ending turn, current_turn becomes me (playerRole), and the other player
  // becomes the guesser — they need agents on MY key to find.
  let canEndTurn = isGuessing && guessCount > 0;
  if (canEndTurn && inSuddenDeath) {
    const remaining = getRemainingAgentsPerPlayer(game);
    const myKeyRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
    canEndTurn = myKeyRemaining > 0;
  }
  
  return (
    <div className="bg-stone-800 border-t border-stone-600 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-center justify-end">
        <div className="flex items-center gap-2">
          {isGuessing && (
            <span className="text-xs text-stone-400">Tap a word to guess</span>
          )}
          
          {canEndTurn && (
            <Button
              onClick={onEndTurn}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              End Turn
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
