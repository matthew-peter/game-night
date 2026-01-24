'use client';

import { Move, CurrentTurn } from '@/lib/supabase/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClueHistoryProps {
  moves: Move[];
  playerRole: CurrentTurn;
  player1Name: string;
  player2Name: string;
  words: string[];
}

export function ClueHistory({ moves, playerRole, player1Name, player2Name, words }: ClueHistoryProps) {
  // Group moves by clue
  const groupedMoves: { clue: Move; guesses: Move[] }[] = [];
  let currentGroup: { clue: Move; guesses: Move[] } | null = null;
  
  for (const move of moves) {
    if (move.move_type === 'clue') {
      if (currentGroup) {
        groupedMoves.push(currentGroup);
      }
      currentGroup = { clue: move, guesses: [] };
    } else if (move.move_type === 'guess' && currentGroup) {
      currentGroup.guesses.push(move);
    }
  }
  
  if (currentGroup) {
    groupedMoves.push(currentGroup);
  }
  
  const getWordFromIndex = (index: number | null) => {
    if (index === null || index < 0 || index >= words.length) return '?';
    return words[index];
  };
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <History className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Clue History</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          {groupedMoves.length === 0 ? (
            <p className="text-center text-stone-500 py-8">
              No moves yet
            </p>
          ) : (
            <div className="space-y-4">
              {groupedMoves.map((group, idx) => {
                return (
                  <div
                    key={group.clue.id}
                    className="p-3 rounded-lg border bg-stone-50 border-stone-200"
                  >
                    {/* Clue header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-stone-400">
                        Turn #{idx + 1}
                      </span>
                    </div>
                    
                    {/* Clue word */}
                    <div className="font-bold text-lg">
                      {group.clue.clue_word}: {group.clue.clue_number}
                    </div>
                    
                    {/* Intended words */}
                    {group.clue.intended_words && group.clue.intended_words.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-stone-500">Intended: </span>
                        <span className="text-xs font-medium">
                          {group.clue.intended_words.map(idx => getWordFromIndex(idx)).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Guesses */}
                    {group.guesses.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-200">
                        <p className="text-xs text-stone-500 mb-1">Guesses:</p>
                        <div className="flex flex-wrap gap-1">
                          {group.guesses.map((guess) => (
                            <span
                              key={guess.id}
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                guess.guess_result === 'agent' && 'bg-green-200 text-green-800',
                                guess.guess_result === 'bystander' && 'bg-amber-200 text-amber-800',
                                guess.guess_result === 'assassin' && 'bg-stone-800 text-white'
                              )}
                            >
                              {getWordFromIndex(guess.guess_index)}
                              {guess.guess_result === 'agent' && ' ✓'}
                              {guess.guess_result === 'bystander' && ' ○'}
                              {guess.guess_result === 'assassin' && ' ☠'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
