'use client';

import { Move, CurrentTurn } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface InlineHistoryProps {
  moves: Move[];
  playerRole: CurrentTurn;
  player1Name: string;
  player2Name: string;
  player1Id: string;
  player2Id: string;
  words: string[];
}

export function InlineHistory({ 
  moves, 
  playerRole, 
  player1Name, 
  player2Name, 
  player1Id, 
  player2Id, 
  words 
}: InlineHistoryProps) {
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

  const getPlayerName = (playerId: string) => {
    if (playerId === player1Id) return player1Name;
    if (playerId === player2Id) return player2Name;
    return 'Unknown';
  };

  const isCurrentUser = (playerId: string) => {
    return (playerRole === 'player1' && playerId === player1Id) ||
           (playerRole === 'player2' && playerId === player2Id);
  };

  if (groupedMoves.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-stone-500 text-sm h-full flex items-center justify-center">
        No moves yet. Give or wait for a clue to start!
      </div>
    );
  }

  // Reverse to show most recent first
  const reversedMoves = [...groupedMoves].reverse();
  
  return (
    <div className="px-3 py-2 space-y-2">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Game Log</h3>
      
      <div className="space-y-2">
          {reversedMoves.map((group, idx) => {{
            const isYourClue = isCurrentUser(group.clue.player_id);
            const clueGiverName = getPlayerName(group.clue.player_id);
            const turnNumber = groupedMoves.length - idx; // Calculate original turn number
            
            return (
              <div
                key={group.clue.id}
                className={cn(
                  "p-2 rounded-lg text-sm",
                  isYourClue 
                    ? "bg-emerald-900/30 border border-emerald-700/50" 
                    : "bg-blue-900/30 border border-blue-700/50"
                )}
              >
                {/* Clue line */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded font-medium",
                      isYourClue ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                    )}>
                      {isYourClue ? 'You' : clueGiverName.split('_')[0]}
                    </span>
                    <span className="font-bold text-white">
                      {group.clue.clue_word?.toUpperCase()}
                    </span>
                    <span className="text-amber-400 font-bold">
                      {group.clue.clue_number}
                    </span>
                  </div>
                  <span className="text-xs text-stone-500">#{turnNumber}</span>
                </div>
                
                {/* Guesses */}
                {group.guesses.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {group.guesses.map((guess) => (
                      <span
                        key={guess.id}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          guess.guess_result === 'agent' && 'bg-emerald-600 text-white',
                          guess.guess_result === 'bystander' && 'bg-amber-600 text-white',
                          guess.guess_result === 'assassin' && 'bg-stone-900 text-red-400 border border-red-600'
                        )}
                      >
                        {getWordFromIndex(guess.guess_index)}
                        {guess.guess_result === 'agent' && ' ✓'}
                        {guess.guess_result === 'bystander' && ' ✗'}
                        {guess.guess_result === 'assassin' && ' ☠'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
  );
}
