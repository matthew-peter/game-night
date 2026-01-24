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
  hasActiveClue?: boolean;
  guessCount?: number;
}

export function GameActions({ 
  game, 
  playerRole, 
  player1Name, 
  player2Name,
  onEndTurn,
  hasActiveClue = false,
  guessCount = 0
}: GameActionsProps) {
  const { moves } = useGameStore();
  
  const isMyTurn = game.current_turn === playerRole;
  const isGuessPhase = game.current_phase === 'guess';
  const isGuessing = !isMyTurn && isGuessPhase; // Guesser is opposite of current turn holder
  const isClueGiver = isMyTurn && game.current_phase === 'clue';
  
  const canEndTurn = isGuessing && guessCount > 0;
  
  return (
    <div className="bg-white border-t p-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <ClueHistory
          moves={moves}
          playerRole={playerRole}
          player1Name={player1Name}
          player2Name={player2Name}
          words={game.words}
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
        
        {isClueGiver && (
          <div className="text-sm text-stone-500 italic">
            Select words & give clue below
          </div>
        )}
        
        {!isMyTurn && !isGuessing && (
          <div className="text-sm text-stone-500 italic">
            Waiting for opponent...
          </div>
        )}
      </div>
    </div>
  );
}
