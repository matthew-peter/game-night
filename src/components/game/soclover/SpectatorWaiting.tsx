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
  const guesserNames = Array.from(playerNames.entries())
    .filter(([seat]) => seat !== mySeat)
    .map(([, name]) => name);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4 min-h-full">
      <div className="flex items-center gap-2 bg-green-800/60 rounded-full px-4 py-2">
        <Eye className="w-4 h-4 text-amber-400" />
        <span className="text-sm text-green-100">
          Your team is guessing your clover...
        </span>
      </div>

      <p className="text-xs text-stone-400 text-center max-w-xs">
        Stay quiet! No hints or reactions until they submit.
      </p>

      <div className="flex flex-wrap gap-1.5 justify-center">
        {guesserNames.map((name) => (
          <span
            key={name}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-800/40 text-green-300"
          >
            {name}
          </span>
        ))}
      </div>

      {guess && (
        <div className="mt-2">
          <p className="text-[0.65rem] text-stone-500 text-center mb-2 uppercase tracking-widest">
            Live — Attempt {guess.attempt}
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
    </div>
  );
}
