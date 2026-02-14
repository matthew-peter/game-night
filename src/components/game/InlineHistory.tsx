'use client';

import { Move, Seat } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { TappableClueWord } from './TappableClueWord';

interface InlineHistoryProps {
  moves: Move[];
  mySeat: Seat;
  myUserId?: string;
  /** Map of player_id → display name */
  playerNameMap: Map<string, string>;
  words: string[];
}

export function InlineHistory({
  moves,
  mySeat,
  myUserId,
  playerNameMap,
  words,
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
    return playerNameMap.get(playerId) ?? 'Unknown';
  };

  if (groupedMoves.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-stone-500 text-sm h-full flex items-center justify-center">
        No moves yet. Give or wait for a clue to start!
      </div>
    );
  }

  const reversedMoves = [...groupedMoves].reverse();

  return (
    <div className="px-3 py-2 space-y-2">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Game Log</h3>

      <div className="space-y-2">
        {reversedMoves.map((group, idx) => {
          const isYourClue = myUserId ? group.clue.player_id === myUserId : false;
          const clueGiverName = isYourClue ? 'You' : getPlayerName(group.clue.player_id);
          const turnNumber = groupedMoves.length - idx;

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    isYourClue ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                  )}>
                    {isYourClue ? 'You' : clueGiverName.split('_')[0]}
                  </span>
                  <TappableClueWord
                    word={group.clue.clue_word?.toUpperCase() || ''}
                    className="font-bold text-white"
                  />
                  <span className="text-amber-400 font-bold">
                    {group.clue.clue_number}
                  </span>
                </div>
                <span className="text-xs text-stone-500">#{turnNumber}</span>
              </div>

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
