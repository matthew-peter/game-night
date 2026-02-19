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
  onSubmitted: () => void;
}

const ZONE_NAMES = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];

export function ClueWritingPhase({
  boardState,
  mySeat,
  gameId,
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
          <span className="font-medium">Your clues are submitted!</span>
        </div>
        <p className="text-sm text-stone-400 text-center">
          Waiting for other players to finish writing...
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {otherPlayersStatus.map(({ seat, submitted }) => (
            <div
              key={seat}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                submitted
                  ? 'bg-emerald-900/50 text-emerald-400'
                  : 'bg-stone-700/50 text-stone-400'
              )}
            >
              Player {seat + 1} {submitted ? '✓' : '...'}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Write Your Clues</h2>
        <p className="text-sm text-stone-400">
          One word per zone — connect the two keywords that face each other
        </p>
      </div>

      <CloverBoard
        cards={boardState.keywordCards}
        placements={clover.cardIndices}
        rotations={clover.rotations}
        clues={clues.map((c) => c || null)}
        compact
      />

      <div className="grid grid-cols-2 gap-3 px-2">
        {ZONE_NAMES.map((name, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-[0.6rem] uppercase tracking-widest text-emerald-400/70 font-medium">
              {name}: {zoneWordPairs[i][0]} + {zoneWordPairs[i][1]}
            </label>
            <Input
              value={clues[i]}
              onChange={(e) => {
                const next = [...clues];
                next[i] = e.target.value.replace(/\s/g, '');
                setClues(next);
              }}
              placeholder="One word..."
              maxLength={30}
              className="bg-stone-800/50 border-stone-600 text-white placeholder:text-stone-500 h-9 text-sm"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || clues.some((c) => !c.trim())}
        className="mx-auto bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Submit Clues
      </Button>
    </div>
  );
}
