'use client';

import { Game, CurrentTurn } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { ClueHistory } from './ClueHistory';
import { useGameStore } from '@/lib/store/gameStore';

interface GameActionsProps {
  game: Game;
  playerRole: CurrentTurn;
  player1Name: string;
  player2Name: string;
  onEndTurn: () => void;
}

export function GameActions({ 
  game, 
  playerRole, 
  player1Name, 
  player2Name,
  onEndTurn 
}: GameActionsProps) {
  const { moves } = useGameStore();
  
  const isMyTurn = game.current_turn === playerRole;
  const hasActiveClue = !!game.current_clue;
  const isGuessing = isMyTurn && hasActiveClue;
  const canEndTurn = isGuessing && game.guesses_this_turn > 0;
  
  return (
    <div className="bg-white border-t p-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <ClueHistory
          moves={moves}
          playerRole={playerRole}
          player1Name={player1Name}
          player2Name={player2Name}
        />
        
        {canEndTurn && (
          <Button
            onClick={onEndTurn}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            End Turn
          </Button>
        )}
        
        {isMyTurn && !hasActiveClue && (
          <div className="text-sm text-stone-500 italic">
            Select words & give clue below
          </div>
        )}
        
        {!isMyTurn && (
          <div className="text-sm text-stone-500 italic">
            Waiting for opponent...
          </div>
        )}
      </div>
    </div>
  );
}
