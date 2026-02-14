'use client';

import { LastPlay } from '@/lib/game/scrabble/types';
import { GamePlayer, Seat } from '@/lib/supabase/types';

interface LastPlayInfoProps {
  lastPlay: LastPlay;
  players: GamePlayer[];
  userId: string;
}

export function LastPlayInfo({ lastPlay, players, userId }: LastPlayInfoProps) {
  const player = players.find(p => p.seat === lastPlay.playerSeat);
  const isMe = player?.user_id === userId;
  const name = isMe ? 'You' : player?.user?.username ?? `Player ${lastPlay.playerSeat + 1}`;

  if (lastPlay.type === 'pass') {
    return (
      <div className="text-xs text-stone-400 text-center py-1">
        {name} passed
      </div>
    );
  }

  if (lastPlay.type === 'exchange') {
    return (
      <div className="text-xs text-stone-400 text-center py-1">
        {name} exchanged {lastPlay.tilesExchanged} tile{lastPlay.tilesExchanged !== 1 ? 's' : ''}
      </div>
    );
  }

  if (lastPlay.type === 'place' && lastPlay.words && lastPlay.totalScore) {
    return (
      <div className="text-xs text-center py-1 space-y-0.5">
        <div className="text-stone-300">
          <span className="font-medium">{name}</span>
          {' played '}
          {lastPlay.words.map((w, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <span className="font-semibold text-amber-300">{w.word}</span>
              <span className="text-stone-400"> ({w.score})</span>
            </span>
          ))}
        </div>
        <div className="text-amber-400 font-medium">
          +{lastPlay.totalScore} points
        </div>
      </div>
    );
  }

  return null;
}
