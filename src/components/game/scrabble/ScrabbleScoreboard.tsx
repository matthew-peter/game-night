'use client';

import { Seat, GamePlayer } from '@/lib/supabase/types';
import { ScrabbleBoardState } from '@/lib/game/scrabble/types';

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

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-stone-800/80 rounded-lg text-sm">
      <div className="flex items-center gap-3">
        {players.map((player) => {
          const isMe = player.user_id === userId;
          const isCurrent = player.seat === currentTurn;
          const score = boardState.scores[player.seat] ?? 0;
          const name = isMe
            ? 'You'
            : player.user?.username ?? `Player ${player.seat + 1}`;

          return (
            <div
              key={player.id}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded
                ${isCurrent ? 'bg-amber-700/50 ring-1 ring-amber-500' : ''}
                ${isMe ? 'text-amber-200' : 'text-stone-300'}
              `}
            >
              <span className="font-medium truncate max-w-[80px]">{name}</span>
              <span className="font-bold text-amber-400">{score}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-stone-400">
        <span className="text-xs">Bag: {tilesInBag}</span>
        <span className="text-xs">Turn: {boardState.turnNumber}</span>
      </div>
    </div>
  );
}
