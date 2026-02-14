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
  const lp = boardState.lastPlay;

  // Last play summary
  let lastPlayText = '';
  if (lp) {
    const p = players.find(pl => pl.seat === lp.playerSeat);
    const who = p?.user_id === userId ? 'You' : p?.user?.username ?? `P${lp.playerSeat + 1}`;
    if (lp.type === 'pass') lastPlayText = `${who} passed`;
    else if (lp.type === 'exchange') lastPlayText = `${who} swapped tiles`;
    else if (lp.type === 'place' && lp.words?.length)
      lastPlayText = `${who}: ${lp.words.map(w => w.word).join(', ')} (+${lp.totalScore})`;
  }

  const nearEnd = boardState.consecutivePasses >= MAX_SCORELESS_TURNS - 2 && boardState.consecutivePasses > 0;

  return (
    <div className="px-3 py-1.5">
      {/* Scores */}
      <div className="flex items-center gap-3">
        {players.map((player) => {
          const isMe = player.user_id === userId;
          const active = player.seat === currentTurn;
          const score = boardState.scores[player.seat] ?? 0;
          const name = isMe ? 'You' : player.user?.username ?? `P${player.seat + 1}`;
          return (
            <div key={player.id} className="flex items-center gap-1.5 text-sm">
              {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              <span className={cn('font-medium', isMe ? 'text-stone-200' : 'text-stone-400')}>{name}</span>
              <span className="font-bold text-amber-400 tabular-nums">{score}</span>
            </div>
          );
        })}
        <span className="ml-auto text-[11px] text-stone-600 tabular-nums">{tilesInBag} in bag</span>
      </div>

      {/* Last play */}
      {(lastPlayText || nearEnd) && (
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          {lastPlayText && <span className="text-stone-500 truncate">{lastPlayText}</span>}
          {nearEnd && (
            <span className="text-amber-500/70 shrink-0 ml-auto">
              {MAX_SCORELESS_TURNS - boardState.consecutivePasses} turns left
            </span>
          )}
        </div>
      )}
    </div>
  );
}
