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
  onGiveClue: (clue: string, intendedWordIndices: number[]) => void;
  hasActiveClue?: boolean;
}

export function ClueInput({ game, playerRole, onGiveClue, hasActiveClue = false }: ClueInputProps) {
  const [clue, setClue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { selectedWordsForClue, clearSelectedWords } = useGameStore();
  
  const isMyTurn = game.current_turn === playerRole;
  const isCluePhase = game.current_phase === 'clue';
  const isGivingClue = isMyTurn && isCluePhase && game.status === 'playing';
  
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
    
    // Convert selected words to indices
    const intendedWordIndices = Array.from(selectedWordsForClue).map(word => 
      game.words.indexOf(word)
    ).filter(idx => idx !== -1);
    
    onGiveClue(trimmedClue, intendedWordIndices);
    setClue('');
    clearSelectedWords();
  };
  
  const selectedCount = selectedWordsForClue.size;
  
  return (
    <div className="bg-stone-800/80 rounded-lg px-3 py-3">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-white/70">🎯 Your turn:</span>
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedCount === 0 ? (
              <span className="text-xs text-white/40 italic">Tap words to hint at</span>
            ) : (
              Array.from(selectedWordsForClue).map((word) => (
                <span
                  key={word}
                  className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] rounded font-medium"
                >
                  {word}
                </span>
              ))
            )}
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelectedWords}
              className="text-xs text-white/50 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={clue}
            onChange={(e) => {
              setClue(e.target.value.replace(/\s/g, ''));
              setError(null);
            }}
            placeholder="ENTER ONE-WORD CLUE"
            className={cn(
              'flex-1 uppercase font-bold text-sm h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40',
              error && 'border-red-500'
            )}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          <Button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-10 px-4"
            disabled={!clue.trim()}
          >
            Give Clue ({selectedCount})
          </Button>
        </form>
        
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    </div>
  );
}
