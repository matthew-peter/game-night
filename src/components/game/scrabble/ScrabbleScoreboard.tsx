'use client';

import { Seat, GamePlayer } from '@/lib/supabase/types';
import { ScrabbleBoardState, MAX_SCORELESS_TURNS } from '@/lib/game/scrabble/types';
import { cn } from '@/lib/utils';

interface ScrabbleScoreboardProps {
  boardState: ScrabbleBoardState;
  players: GamePlayer[];
  currentTurn: Seat;
  mySeat: Seat;
  userId: string;
}

export function ScrabbleScoreboard({
  boardState,
  players,
  currentTurn,
  mySeat,
  userId,
}: ScrabbleScoreboardProps) {
  const tilesInBag = boardState.tileBag.length;
  const scorelessWarning = boardState.consecutivePasses >= MAX_SCORELESS_TURNS - 2 && boardState.consecutivePasses > 0;
  const lastPlay = boardState.lastPlay;

  // Build last play text
  let lastPlayText = '';
  if (lastPlay) {
    const p = players.find(pl => pl.seat === lastPlay.playerSeat);
    const name = p?.user_id === userId ? 'You' : p?.user?.username ?? `P${lastPlay.playerSeat + 1}`;
    if (lastPlay.type === 'pass') {
      lastPlayText = `${name} passed`;
    } else if (lastPlay.type === 'exchange') {
      lastPlayText = `${name} swapped ${lastPlay.tilesExchanged} tile${lastPlay.tilesExchanged !== 1 ? 's' : ''}`;
    } else if (lastPlay.type === 'place' && lastPlay.words?.length) {
      const wordList = lastPlay.words.map(w => w.word).join(', ');
      lastPlayText = `${name}: ${wordList} (+${lastPlay.totalScore})`;
    }
  }

  return (
    <div className="px-3 py-1.5 bg-stone-800/80">
      {/* Scores row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          {players.map((player) => {
            const isMe = player.user_id === userId;
            const isCurrent = player.seat === currentTurn;
            const score = boardState.scores[player.seat] ?? 0;
            const name = isMe ? 'You' : player.user?.username ?? `P${player.seat + 1}`;

            return (
              <div
                key={player.id}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-sm shrink-0',
                  isCurrent && 'bg-amber-900/40',
                )}
              >
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                )}
                <span className={cn(
                  'font-medium truncate max-w-[64px]',
                  isMe ? 'text-stone-100' : 'text-stone-400'
                )}>
                  {name}
                </span>
                <span className="font-bold text-amber-400 tabular-nums">{score}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-stone-500 shrink-0 ml-2 tabular-nums">
          <span>{tilesInBag} left</span>
        </div>
      </div>

      {/* Last play + warnings (single line) */}
      {(lastPlayText || scorelessWarning) && (
        <div className="flex items-center justify-between mt-0.5 text-[11px]">
          {lastPlayText && (
            <span className="text-stone-500 truncate">{lastPlayText}</span>
          )}
          {scorelessWarning && (
            <span className="text-amber-500/80 shrink-0 ml-auto">
              {MAX_SCORELESS_TURNS - boardState.consecutivePasses} turns left
            </span>
          )}
        </div>
      )}
    </div>
  );
}
