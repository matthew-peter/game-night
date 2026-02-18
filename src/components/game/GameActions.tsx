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
  const isGuesser = game.current_turn !== mySeat;
  const isGuessPhase = game.current_phase === 'guess';
  const isGuessing = isGuesser && isGuessPhase && game.status === 'playing';
  const inSuddenDeath = game.sudden_death === true;

  // In sudden death you can always pass (no guess required).
  // Outside sudden death you must guess at least once before ending your turn.
  let canEndTurn = isGuessing && (inSuddenDeath || guessCount > 0);

  // If tokens are exhausted or in sudden death, also check that the other
  // player still has agents to find (otherwise passing is pointless).
  if (canEndTurn && (inSuddenDeath || game.timer_tokens <= 0)) {
    const remaining = getRemainingAgentsPerSeat(game);
    const myKeyRemaining = remaining[mySeat] ?? 0;
    canEndTurn = myKeyRemaining > 0;
  }

  const buttonLabel = inSuddenDeath ? 'Pass' : 'End Turn';

  return (
    <div className="bg-stone-800 border-t border-stone-600 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-center justify-end">
        <div className="flex items-center gap-2">
          {isGuessing && (
            <span className="text-xs text-stone-400">
              {inSuddenDeath ? 'Guess or pass' : 'Tap a word to guess'}
            </span>
          )}

          {canEndTurn && (
            <Button
              onClick={onEndTurn}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
