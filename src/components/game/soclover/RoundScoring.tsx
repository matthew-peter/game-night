'use client';

import { cn } from '@/lib/utils';
import { Trophy, Star } from 'lucide-react';

interface RoundScoringProps {
  roundScores: (number | null)[];
  spectatorOrder: number[];
  playerNames: Map<number, string>;
  totalScore: number;
  maxScore: number;
}

export function RoundScoring({
  roundScores,
  spectatorOrder,
  playerNames,
  totalScore,
  maxScore,
}: RoundScoringProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center gap-2 text-amber-400">
        <Trophy className="w-6 h-6" />
        <span className="text-2xl font-bold">{totalScore} / {maxScore}</span>
      </div>

      <div className="w-full max-w-xs space-y-2">
        {spectatorOrder.map((seat) => {
          const score = roundScores[seat];
          const name = playerNames.get(seat) ?? `Player ${seat + 1}`;
          const isPerfect = score === 6;

          return (
            <div
              key={seat}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg',
                isPerfect ? 'bg-amber-900/40' : 'bg-stone-800/50'
              )}
            >
              <span className="text-sm text-white font-medium">{name}</span>
              <div className="flex items-center gap-1">
                {isPerfect && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                <span className={cn(
                  'text-sm font-bold',
                  isPerfect ? 'text-amber-400' : 'text-stone-300'
                )}>
                  {score ?? '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
