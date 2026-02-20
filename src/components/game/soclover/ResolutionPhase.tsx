'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CloverBoard } from './CloverBoard';
import { CardTray } from './CardTray';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { getCurrentSpectatorSeat, getResolutionCardIndices } from '@/lib/game/soclover/logic';
import { cn } from '@/lib/utils';
import { CheckCircle, Loader2, Hand } from 'lucide-react';
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

  const driverSeat = guess?.driverSeat ?? null;
  const isDriver = driverSeat === mySeat;
  const hasDriver = driverSeat != null;
  const driverName = driverSeat != null
    ? (playerNames.get(driverSeat) ?? `Player ${driverSeat + 1}`)
    : null;

  const [submitting, setSubmitting] = useState(false);
  const [takingControl, setTakingControl] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const availableCardIndices = useMemo(
    () => getResolutionCardIndices(boardState, spectatorSeat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spectatorSeat, spectatorClover.cardIndices, JSON.stringify(spectatorClover.decoyCardIndices)]
  );

  const placements = guess?.placements ?? [null, null, null, null];
  const rotations = guess?.rotations ?? [0, 0, 0, 0];

  // ── Actions (only for the driver) ──────────────────────────────────

  const sendPlacement = useCallback(async (
    newPlacements: (number | null)[],
    newRotations: number[]
  ) => {
    try {
      const res = await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'place_cards',
          placements: newPlacements,
          rotations: newRotations,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to place card');
      }
    } catch {
      toast.error('Network error');
    }
  }, [gameId]);

  const handleSlotTap = useCallback((position: number) => {
    if (!isDriver || selectedCard == null) return;

    const newPlacements = [...placements] as (number | null)[];
    const newRotations = [...rotations];

    const existingPos = newPlacements.indexOf(selectedCard);
    if (existingPos !== -1) {
      newPlacements[existingPos] = null;
      newRotations[existingPos] = 0;
    }

    if (newPlacements[position] != null && existingPos !== -1) {
      newPlacements[existingPos] = newPlacements[position];
      newRotations[existingPos] = newRotations[position];
    }

    newPlacements[position] = selectedCard;
    if (existingPos === -1) {
      newRotations[position] = 0;
    }

    setSelectedCard(null);
    sendPlacement(newPlacements, newRotations);
  }, [isDriver, selectedCard, placements, rotations, sendPlacement]);

  const handleRotate = useCallback((position: number) => {
    if (!isDriver) return;
    const newRotations = [...rotations];
    newRotations[position] = (newRotations[position] + 1) % 4;
    sendPlacement([...placements], newRotations);
  }, [isDriver, placements, rotations, sendPlacement]);

  const handleRemove = useCallback((position: number) => {
    if (!isDriver) return;
    const newPlacements = [...placements] as (number | null)[];
    const newRotations = [...rotations];
    newPlacements[position] = null;
    newRotations[position] = 0;
    sendPlacement(newPlacements, newRotations);
  }, [isDriver, placements, rotations, sendPlacement]);

  // ── Take control ────────────────────────────────────────────────────

  const handleTakeControl = useCallback(async () => {
    setTakingControl(true);
    try {
      const res = await fetch(`/api/games/${gameId}/soclover-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveType: 'take_control' }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to take control');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTakingControl(false);
      setSelectedCard(null);
    }
  }, [gameId]);

  // ── Submit guess ────────────────────────────────────────────────────

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
  const attemptLabel = guess?.attempt === 2 ? 'ATTEMPT 2' : 'ATTEMPT 1';
  const totalCards = 4 + (boardState.decoyCount ?? 1);

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Header */}
      <div className="text-center px-2">
        <h2 className="text-base font-bold text-white">
          {spectatorName}&apos;s Clover
        </h2>
        <div className="flex items-center justify-center gap-2 mt-0.5">
          <span className="text-[0.65rem] uppercase tracking-widest text-amber-300 font-semibold">
            {attemptLabel}
          </span>
          <span className="text-[0.6rem] text-stone-500">
            {totalCards} cards → 4 slots
          </span>
        </div>
        {guess?.attempt === 2 && guess.firstAttemptResults && (
          <p className="text-xs text-amber-400 mt-1">
            Incorrect cards removed — place the remaining ones
          </p>
        )}
      </div>

      {/* Driver status banner */}
      <div className={cn(
        'mx-2 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs',
        isDriver
          ? 'bg-green-800/50 border border-green-600/30'
          : 'bg-stone-800/50 border border-stone-600/20'
      )}>
        <span className={isDriver ? 'text-green-300' : 'text-stone-400'}>
          {isDriver
            ? 'You are arranging the cards'
            : hasDriver
              ? `${driverName} is arranging`
              : 'No one is arranging yet'}
        </span>
        {!isDriver && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTakeControl}
            disabled={takingControl}
            className="h-6 px-2 text-xs text-green-300 hover:text-green-200 hover:bg-green-800/40"
          >
            {takingControl ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Hand className="w-3 h-3 mr-1" />
            )}
            Take Control
          </Button>
        )}
      </div>

      {/* Clover board — interactive only for driver */}
      <div className="flex justify-center">
        <CloverBoard
          cards={boardState.keywordCards}
          placements={placements}
          rotations={rotations}
          clues={spectatorClover.clues}
          onSlotTap={isDriver ? handleSlotTap : undefined}
          onRotate={isDriver ? handleRotate : undefined}
          onRemove={isDriver ? handleRemove : undefined}
          highlights={guess?.firstAttemptResults?.map((r) =>
            r ? 'correct' : null
          ) ?? undefined}
          interactive={isDriver}
        />
      </div>

      {/* Card tray — only shown to driver */}
      {isDriver && (
        <CardTray
          cards={boardState.keywordCards}
          cardIndices={availableCardIndices}
          placedIndices={placements}
          selectedCard={selectedCard}
          onSelectCard={setSelectedCard}
        />
      )}

      {/* Submit button — any non-spectator can submit */}
      <div className="flex justify-center gap-2">
        <Button
          onClick={handleSubmitGuess}
          disabled={!allPlaced || submitting}
          size="sm"
          className={cn(
            'gap-2',
            allPlaced
              ? 'bg-green-600 hover:bg-green-500 text-white'
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
      </div>

      {/* Round progress dots */}
      <div className="flex justify-center gap-1.5 mt-1">
        {boardState.spectatorOrder.map((seat, idx) => {
          const name = playerNames.get(seat);
          const initial = name ? name[0].toUpperCase() : String(seat + 1);
          return (
            <div
              key={seat}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold',
                idx < boardState.currentSpectatorIdx
                  ? 'bg-green-600 text-white'
                  : idx === boardState.currentSpectatorIdx
                    ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                    : 'bg-stone-700 text-stone-500'
              )}
              title={name}
            >
              {boardState.roundScores[seat] != null
                ? boardState.roundScores[seat]
                : initial}
            </div>
          );
        })}
      </div>
    </div>
  );
}
