'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CloverBoard } from './CloverBoard';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { getZoneWordsForClover } from '@/lib/game/soclover/logic';
import { cn } from '@/lib/utils';
import { Send, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ClueWritingPhaseProps {
  boardState: SoCloverBoardState;
  mySeat: number;
  gameId: string;
  playerNames: Map<number, string>;
  onSubmitted: () => void;
}

const ZONE_NAMES = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];
const ZONE_COLORS = [
  'text-sky-400/80',
  'text-rose-400/80',
  'text-amber-400/80',
  'text-violet-400/80',
];

export function ClueWritingPhase({
  boardState,
  mySeat,
  gameId,
  playerNames,
  onSubmitted,
}: ClueWritingPhaseProps) {
  const clover = boardState.clovers[mySeat];
  const [clues, setClues] = useState<string[]>(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);

  const alreadySubmitted = clover.cluesSubmitted;

  const zoneWordPairs = useMemo(() => {
    return [0, 1, 2, 3].map((zone) => getZoneWordsForClover(boardState, mySeat, zone));
  }, [boardState, mySeat]);

  const otherPlayersStatus = useMemo(() => {
    return boardState.clovers
      .map((c, i) => ({ seat: i, submitted: c.cluesSubmitted }))
      .filter((_, i) => i !== mySeat);
  }, [boardState.clovers, mySeat]);

  const handleSubmit = async () => {
    const trimmed = clues.map((c) => c.trim());
    if (trimmed.some((c) => !c)) {
      toast.error('All 4 clues are required');
      return;
    }
    if (trimmed.some((c) => /\s/.test(c))) {
      toast.error('Each clue must be a single word');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveType: 'submit_clues', clues: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit clues');
      } else {
        toast.success('Clues submitted!');
        onSubmitted();
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadySubmitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6">
        <div className="flex items-center gap-2 text-emerald-400">
          <Check className="w-5 h-5" />
          <span className="font-medium">Clues submitted!</span>
        </div>
        <p className="text-sm text-stone-400 text-center">
          Waiting for others to finish writing...
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {otherPlayersStatus.map(({ seat, submitted }) => {
            const name = playerNames.get(seat) ?? `Player ${seat + 1}`;
            return (
              <div
                key={seat}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  submitted
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-stone-700/50 text-stone-400'
                )}
              >
                {name} {submitted ? '✓' : '...'}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-center">
        <h2 className="text-base font-bold text-white">Write Your Clues</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          One word per zone — connect the two keywords facing each other
        </p>
      </div>

      <div className="flex justify-center">
        <CloverBoard
          cards={boardState.keywordCards}
          placements={clover.cardIndices}
          rotations={clover.rotations}
          clues={clues.map((c) => c || null)}
          compact
        />
      </div>

      {/* Clue inputs — one per zone */}
      <div className="space-y-2.5 px-1">
        {ZONE_NAMES.map((name, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-1">
              <span className={cn('text-[0.65rem] uppercase tracking-wider font-bold', ZONE_COLORS[i])}>
                {zoneWordPairs[i][0]}
              </span>
              <span className="text-[0.55rem] text-stone-500">+</span>
              <span className={cn('text-[0.65rem] uppercase tracking-wider font-bold', ZONE_COLORS[i])}>
                {zoneWordPairs[i][1]}
              </span>
            </div>
            <Input
              value={clues[i]}
              onChange={(e) => {
                const next = [...clues];
                next[i] = e.target.value.replace(/\s/g, '').toUpperCase();
                setClues(next);
              }}
              placeholder={name}
              maxLength={30}
              className="bg-stone-800/50 border-stone-600 text-white placeholder:text-stone-600 h-8 text-sm uppercase tracking-wide text-center"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={submitting || clues.some((c) => !c.trim())}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Submit Clues
        </Button>
      </div>
    </div>
  );
}
