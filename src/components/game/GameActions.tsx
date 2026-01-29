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
  player1Id: string;
  player2Id: string;
  onEndTurn: () => void;
  hasActiveClue?: boolean;
  guessCount?: number;
}

export function GameActions({ 
  game, 
  playerRole, 
  player1Name, 
  player2Name,
  player1Id,
  player2Id,
  onEndTurn,
  hasActiveClue = false,
  guessCount = 0
}: GameActionsProps) {
  const { moves } = useGameStore();
  
  const isClueGiver = game.current_turn === playerRole;
  const isGuesser = game.current_turn !== playerRole;
  const isGuessPhase = game.current_phase === 'guess';
  // Guesser: I'm NOT the clue giver and we're in guess phase
  const isGuessing = isGuesser && isGuessPhase && game.status === 'playing';
  
  const canEndTurn = isGuessing && guessCount > 0;
  
  return (
    <div className="bg-stone-800 border-t border-stone-600 px-2 py-2">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClueHistory
            moves={moves}
            playerRole={playerRole}
            player1Name={player1Name}
            player2Name={player2Name}
            player1Id={player1Id}
            player2Id={player2Id}
            words={game.words}
          />
        </div>
        
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
