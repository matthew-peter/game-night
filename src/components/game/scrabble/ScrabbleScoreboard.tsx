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
  const isMyTurn = currentTurn === mySeat;
  const lp = boardState.lastPlay;

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
    <div className={cn(
      'mx-2 my-1 px-4 py-2.5 rounded-2xl shadow-lg transition-all duration-300',
      isMyTurn
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/25'
        : 'bg-gradient-to-r from-stone-500 to-stone-400 shadow-stone-500/15',
    )}>
      {/* Turn label */}
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          isMyTurn ? 'text-white' : 'text-white/70',
        )}>
          {isMyTurn ? '▶  Your Turn' : 'Waiting...'}
        </span>
        <span className="text-xs text-white/50 tabular-nums">{tilesInBag} in bag</span>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-5">
        {players.map((player) => {
          const isMe = player.user_id === userId;
          const active = player.seat === currentTurn;
          const score = boardState.scores[player.seat] ?? 0;
          const name = isMe ? 'You' : player.user?.username ?? `P${player.seat + 1}`;
          return (
            <div key={player.id} className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-semibold',
                active ? 'text-white' : 'text-white/50',
              )}>
                {name}
              </span>
              <span className={cn(
                'text-xl font-bold tabular-nums',
                active ? 'text-white' : 'text-white/60',
              )}>
                {score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last play / warning */}
      {(lastPlayText || nearEnd) && (
        <div className="flex items-center justify-between text-[11px] mt-1">
          {lastPlayText && <span className="text-white/40 truncate">{lastPlayText}</span>}
          {nearEnd && (
            <span className="text-white/80 font-medium shrink-0 ml-auto">
              {MAX_SCORELESS_TURNS - boardState.consecutivePasses} scoreless turns left
            </span>
          )}
        </div>
      )}
    </div>
  );
}
