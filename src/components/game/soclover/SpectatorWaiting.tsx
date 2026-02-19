'use client';

import { CloverBoard } from './CloverBoard';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { Eye } from 'lucide-react';

interface SpectatorWaitingProps {
  boardState: SoCloverBoardState;
  mySeat: number;
  playerNames: Map<number, string>;
}

export function SpectatorWaiting({
  boardState,
  mySeat,
  playerNames,
}: SpectatorWaitingProps) {
  const guess = boardState.currentGuess;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center gap-2 bg-stone-800/80 rounded-full px-4 py-2">
        <Eye className="w-4 h-4 text-amber-400" />
        <span className="text-sm text-stone-300">
          Your team is guessing your clover...
        </span>
      </div>

      <p className="text-xs text-stone-500 text-center max-w-xs">
        Stay quiet! You cannot help or give hints while they figure out your clues.
      </p>

      {guess && (
        <div className="mt-2">
          <p className="text-xs text-stone-500 text-center mb-2">
            Live view — Attempt {guess.attempt}
          </p>
          <CloverBoard
            cards={boardState.keywordCards}
            placements={guess.placements}
            rotations={guess.rotations}
            clues={boardState.clovers[mySeat].clues}
            compact
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {Array.from(playerNames.entries())
          .filter(([seat]) => seat !== mySeat)
          .map(([seat, name]) => (
            <div
              key={seat}
              className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-400"
            >
              {name}
            </div>
          ))}
      </div>
    </div>
  );
}
