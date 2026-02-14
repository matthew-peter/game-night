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
  const scorelessWarning = boardState.consecutivePasses >= MAX_SCORELESS_TURNS - 2;

  return (
    <div className="px-3 py-2 bg-stone-800/90 border-b border-stone-700/50">
      <div className="max-w-md mx-auto">
        {/* Player scores row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {players.map((player) => {
              const isMe = player.user_id === userId;
              const isCurrent = player.seat === currentTurn;
              const score = boardState.scores[player.seat] ?? 0;
              const name = isMe
                ? 'You'
                : player.user?.username ?? `P${player.seat + 1}`;

              return (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-all',
                    isCurrent && 'bg-amber-600/30 ring-1 ring-amber-500/60',
                    isMe ? 'text-white' : 'text-stone-300'
                  )}
                >
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  )}
                  <span className="font-medium truncate max-w-[72px]">{name}</span>
                  <span className="font-bold text-amber-400 tabular-nums">{score}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-400 shrink-0 ml-2">
            <div className="flex items-center gap-1" title={`${tilesInBag} tiles remaining in the bag`}>
              <span className="text-amber-500/70">bag</span>
              <span className="font-semibold text-stone-300 tabular-nums">{tilesInBag}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-amber-500/70">turn</span>
              <span className="font-semibold text-stone-300 tabular-nums">{boardState.turnNumber}</span>
            </div>
          </div>
        </div>

        {/* Scoreless turns warning */}
        {scorelessWarning && boardState.consecutivePasses > 0 && (
          <div className="mt-1 text-[10px] text-amber-400/80 text-center">
            {MAX_SCORELESS_TURNS - boardState.consecutivePasses} scoreless turn{MAX_SCORELESS_TURNS - boardState.consecutivePasses !== 1 ? 's' : ''} until game ends
          </div>
        )}
      </div>
    </div>
  );
}
