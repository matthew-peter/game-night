'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CloverBoard } from './CloverBoard';
import { CardTray } from './CardTray';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { getCurrentSpectatorSeat, getResolutionCardIndices } from '@/lib/game/soclover/logic';
import { cn } from '@/lib/utils';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ResolutionPhaseProps {
  boardState: SoCloverBoardState;
  mySeat: number;
  gameId: string;
  playerNames: Map<number, string>;
  onUpdated: () => void;
}

export function ResolutionPhase({
  boardState,
  mySeat,
  gameId,
  playerNames,
  onUpdated,
}: ResolutionPhaseProps) {
  const spectatorSeat = getCurrentSpectatorSeat(boardState)!;
  const spectatorClover = boardState.clovers[spectatorSeat];
  const guess = boardState.currentGuess;

  const [submitting, setSubmitting] = useState(false);
  const dragCardRef = useRef<number | null>(null);

  const availableCardIndices = useMemo(
    () => getResolutionCardIndices(boardState, spectatorSeat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spectatorSeat, spectatorClover.cardIndices, spectatorClover.decoyCardIndex]
  );

  const placements = guess?.placements ?? [null, null, null, null];
  const rotations = guess?.rotations ?? [0, 0, 0, 0];

  const sendPlacement = useCallback(async (
    newPlacements: (number | null)[],
    newRotations: number[]
  ) => {
    try {
      await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'place_cards',
          placements: newPlacements,
          rotations: newRotations,
        }),
      });
    } catch {
      toast.error('Failed to sync placement');
    }
  }, [gameId]);

  const handleDragStart = useCallback((cardIndex: number) => {
    dragCardRef.current = cardIndex;
  }, []);

  const handleDrop = useCallback((position: number) => {
    const cardIndex = dragCardRef.current;
    if (cardIndex == null) return;
    dragCardRef.current = null;

    const newPlacements = [...placements] as (number | null)[];
    const newRotations = [...rotations];

    const existingPos = newPlacements.indexOf(cardIndex);
    if (existingPos !== -1) {
      newPlacements[existingPos] = null;
      newRotations[existingPos] = 0;
    }

    if (newPlacements[position] != null) {
      if (existingPos !== -1) {
        newPlacements[existingPos] = newPlacements[position];
        newRotations[existingPos] = newRotations[position];
      }
    }

    newPlacements[position] = cardIndex;
    if (existingPos === -1) {
      newRotations[position] = 0;
    }

    sendPlacement(newPlacements, newRotations);
  }, [placements, rotations, sendPlacement]);

  const handleRotate = useCallback((position: number) => {
    const newRotations = [...rotations];
    newRotations[position] = (newRotations[position] + 1) % 4;
    sendPlacement([...placements], newRotations);
  }, [placements, rotations, sendPlacement]);

  const handleRemove = useCallback((position: number) => {
    const newPlacements = [...placements] as (number | null)[];
    const newRotations = [...rotations];
    newPlacements[position] = null;
    newRotations[position] = 0;
    sendPlacement(newPlacements, newRotations);
  }, [placements, rotations, sendPlacement]);

  const handleSubmitGuess = async () => {
    if (placements.some((p) => p === null)) {
      toast.error('Place all 4 cards before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'submit_guess',
          placements,
          rotations,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit guess');
      } else {
        const data = await res.json();
        if (data.score !== undefined && data.score !== -1) {
          toast.success(`Round scored: ${data.score} points!`);
        } else if (data.score === -1) {
          toast.info('Not all correct — try again!');
        }
        onUpdated();
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const allPlaced = placements.every((p) => p !== null);
  const spectatorName = playerNames.get(spectatorSeat) ?? `Player ${spectatorSeat + 1}`;
  const attemptLabel = guess?.attempt === 2 ? 'Second Attempt' : 'First Attempt';

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">
          {spectatorName}&apos;s Clover
        </h2>
        <p className="text-sm text-stone-400">
          {attemptLabel} — Place and rotate cards to match the clues
        </p>
        {guess?.attempt === 2 && guess.firstAttemptResults && (
          <p className="text-xs text-amber-400 mt-1">
            Incorrect cards removed. Place the remaining cards.
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <CloverBoard
          cards={boardState.keywordCards}
          placements={placements}
          rotations={rotations}
          clues={spectatorClover.clues}
          onDrop={handleDrop}
          onRotate={handleRotate}
          onRemove={handleRemove}
          highlights={guess?.firstAttemptResults?.map((r) =>
            r ? 'correct' : null
          ) ?? undefined}
          interactive
        />
      </div>

      <CardTray
        cards={boardState.keywordCards}
        cardIndices={availableCardIndices}
        placedIndices={placements}
        onDragStart={handleDragStart}
      />

      <Button
        onClick={handleSubmitGuess}
        disabled={!allPlaced || submitting}
        className={cn(
          'mx-auto gap-2',
          allPlaced
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-stone-700 text-stone-400'
        )}
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        Submit Guess
      </Button>

      {/* Round progress */}
      <div className="flex justify-center gap-1 mt-1">
        {boardState.spectatorOrder.map((seat, idx) => (
          <div
            key={seat}
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
              idx < boardState.currentSpectatorIdx
                ? 'bg-emerald-600 text-white'
                : idx === boardState.currentSpectatorIdx
                  ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                  : 'bg-stone-700 text-stone-500'
            )}
          >
            {boardState.roundScores[seat] ?? (idx <= boardState.currentSpectatorIdx ? '?' : '·')}
          </div>
        ))}
      </div>
    </div>
  );
}
