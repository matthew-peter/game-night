'use client';

import { Game, Seat } from '@/lib/supabase/types';
import { getRemainingAgentsPerSeat } from '@/lib/game/gameLogic';
import { Button } from '@/components/ui/button';

interface GameActionsProps {
  game: Game;
  mySeat: Seat;
  onEndTurn: () => void;
  guessCount?: number;
}

export function GameActions({
  game,
  mySeat,
  onEndTurn,
  guessCount = 0,
}: GameActionsProps) {
  const isClueGiver = game.current_turn === mySeat;
  const isGuesser = game.current_turn !== mySeat;
  const isGuessPhase = game.current_phase === 'guess';
  const isGuessing = isGuesser && isGuessPhase && game.status === 'playing';
  const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;

  let canEndTurn = isGuessing && guessCount > 0;
  if (canEndTurn && inSuddenDeath) {
    const remaining = getRemainingAgentsPerSeat(game);
    const myKeyRemaining = remaining[mySeat] ?? 0;
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
