'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { Game, CurrentTurn } from '@/lib/supabase/types';
import { validateClue } from '@/lib/game/clueValidator';
import { getUnrevealedWords } from '@/lib/game/gameLogic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ClueInputProps {
  game: Game;
  playerRole: CurrentTurn;
  onGiveClue: (clue: string, intendedWords: string[]) => void;
}

export function ClueInput({ game, playerRole, onGiveClue }: ClueInputProps) {
  const [clue, setClue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { selectedWordsForClue, clearSelectedWords } = useGameStore();
  
  const isMyTurn = game.current_turn === playerRole;
  const hasActiveClue = !!game.current_clue;
  const isGivingClue = isMyTurn && !hasActiveClue && game.status === 'playing';
  
  if (!isGivingClue) return null;
  
  const unrevealedWords = getUnrevealedWords(game.words, game.board_state);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const trimmedClue = clue.trim().toUpperCase();
    
    // Validate clue
    const validation = validateClue(trimmedClue, unrevealedWords, game.clue_strictness);
    if (!validation.valid) {
      setError(validation.reason || 'Invalid clue');
      return;
    }
    
    const intendedWords = Array.from(selectedWordsForClue);
    
    onGiveClue(trimmedClue, intendedWords);
    setClue('');
    clearSelectedWords();
  };
  
  const selectedCount = selectedWordsForClue.size;
  
  return (
    <div className="bg-white border-t shadow-lg p-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-3">
          <p className="text-sm font-medium text-stone-600 mb-1">
            Your turn to give a clue
          </p>
          <p className="text-xs text-stone-500">
            Tap words you&apos;re hinting at, then type your one-word clue
          </p>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedCount === 0 ? (
              <span className="text-sm text-stone-400 italic">
                No words selected (will be &quot;0&quot; clue)
              </span>
            ) : (
              Array.from(selectedWordsForClue).map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium"
                >
                  {word}
                </span>
              ))
            )}
          </div>
          {selectedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelectedWords}
              className="text-stone-500"
            >
              Clear
            </Button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              value={clue}
              onChange={(e) => {
                setClue(e.target.value.replace(/\s/g, ''));
                setError(null);
              }}
              placeholder="Enter one-word clue"
              className={cn(
                'uppercase font-medium',
                error && 'border-red-500 focus:ring-red-500'
              )}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            className="bg-green-600 hover:bg-green-700 min-w-[100px]"
            disabled={!clue.trim()}
          >
            Give Clue ({selectedCount})
          </Button>
        </form>
        
        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
