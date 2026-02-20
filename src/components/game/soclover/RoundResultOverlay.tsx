'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CloverBoard } from './CloverBoard';
import { RoundResult, SoCloverBoardState } from '@/lib/game/soclover/types';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Star, Loader2, ArrowRight } from 'lucide-react';

interface RoundResultOverlayProps {
  boardState: SoCloverBoardState;
  result: RoundResult;
  mySeat: number;
  gameId: string;
  playerNames: Map<number, string>;
  totalPlayers: number;
}

export function RoundResultOverlay({
  boardState,
  result,
  mySeat,
  gameId,
  playerNames,
  totalPlayers,
}: RoundResultOverlayProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const hasAcked = result.acknowledged.includes(mySeat);
  const ackedCount = result.acknowledged.length;

  const spectatorName = playerNames.get(result.spectatorSeat) ?? `Player ${result.spectatorSeat + 1}`;
  const isPerfect = result.score === 6;
  const correctCount = result.correctPlacements.filter(Boolean).length;

  const handleAcknowledge = useCallback(async () => {
    setAcknowledging(true);
    try {
      await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveType: 'acknowledge_result' }),
      });
    } catch {
      // Will retry
    } finally {
      setAcknowledging(false);
    }
  }, [gameId]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Score display */}
      <div className={cn(
        'flex flex-col items-center gap-1 px-6 py-3 rounded-2xl',
        isPerfect
          ? 'bg-amber-500/20 border border-amber-400/30'
          : 'bg-green-800/30 border border-green-600/20'
      )}>
        {isPerfect && <Star className="w-6 h-6 text-amber-400 fill-amber-400 animate-in zoom-in duration-500" />}
        <span className={cn(
          'text-3xl font-black tabular-nums',
          isPerfect ? 'text-amber-400' : 'text-white'
        )}>
          {result.score} / 6
        </span>
        <span className="text-xs text-stone-400">
          {spectatorName}&apos;s round — Attempt {result.attempt}
        </span>
      </div>

      {/* Position results */}
      <div className="flex gap-2">
        {result.correctPlacements.map((correct, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              'animate-in fade-in duration-300',
              correct
                ? 'bg-emerald-900/50 text-emerald-400'
                : 'bg-red-900/30 text-red-400'
            )}
            style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'both' }}
          >
            {correct ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            Slot {i + 1}
          </div>
        ))}
      </div>

      {/* Correct arrangement */}
      <div className="mt-1">
        <p className="text-[0.65rem] text-stone-500 text-center mb-2 uppercase tracking-widest">
          Correct arrangement
        </p>
        <CloverBoard
          cards={boardState.keywordCards}
          placements={result.actualCardIndices}
          rotations={result.actualRotations}
          clues={boardState.clovers[result.spectatorSeat].clues}
          highlights={result.correctPlacements.map(c => c ? 'correct' : 'incorrect')}
          compact
        />
      </div>

      {/* Acknowledge button */}
      <div className="flex flex-col items-center gap-1.5 mt-2">
        {!hasAcked ? (
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            size="sm"
            className="bg-green-600 hover:bg-green-500 text-white gap-2 px-6"
          >
            {acknowledging ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Continue
          </Button>
        ) : (
          <span className="text-xs text-green-400 font-medium">
            Waiting for others...
          </span>
        )}
        <span className="text-[0.6rem] text-stone-500">
          {ackedCount} / {totalPlayers} ready
        </span>
      </div>
    </div>
  );
}
