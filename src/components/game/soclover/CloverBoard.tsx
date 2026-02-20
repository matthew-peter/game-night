'use client';

import { cn } from '@/lib/utils';
import { KeywordCard } from './KeywordCard';
import { KeywordCardWords } from '@/lib/game/soclover/types';

interface CloverBoardProps {
  cards: KeywordCardWords[];
  placements: (number | null)[];
  rotations: number[];
  clues: (string | null)[];
  onSlotTap?: (position: number) => void;
  onRotate?: (position: number) => void;
  onRemove?: (position: number) => void;
  highlights?: ('correct' | 'incorrect' | null)[];
  interactive?: boolean;
  compact?: boolean;
  hasSelection?: boolean;
}

const ZONE_LABELS = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];

export function CloverBoard({
  cards,
  placements,
  rotations,
  clues,
  onSlotTap,
  onRotate,
  onRemove,
  highlights,
  interactive = false,
  compact = false,
  hasSelection = false,
}: CloverBoardProps) {
  const slotSize = compact
    ? 'w-[4.75rem] h-[4.75rem]'
    : 'w-[5.5rem] h-[5.5rem]';
  const cardSize = compact ? ('sm' as const) : ('md' as const);

  const renderCardSlot = (position: number) => {
    const cardIdx = placements[position];
    const hasCard = cardIdx != null;
    const highlight = highlights?.[position] ?? null;

    if (hasCard) {
      return (
        <div className="relative group animate-in fade-in zoom-in-95 duration-200">
          <KeywordCard
            words={cards[cardIdx]}
            rotation={rotations[position]}
            rotatable={interactive}
            onRotate={() => onRotate?.(position)}
            highlight={highlight}
            size={cardSize}
          />
          {interactive && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove?.(position); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 text-white text-xs
                         flex items-center justify-center shadow-md hover:bg-red-400 z-10
                         transition-transform hover:scale-110 active:scale-90"
            >
              ×
            </button>
          )}
        </div>
      );
    }

    const slotReady = interactive && hasSelection;
    return (
      <button
        onClick={() => interactive && onSlotTap?.(position)}
        className={cn(
          slotSize,
          'rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-300',
          slotReady
            ? 'border-emerald-400 bg-emerald-900/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-pulse cursor-pointer active:scale-95'
            : interactive
              ? 'border-emerald-400/50 bg-emerald-950/30 hover:bg-emerald-900/50 hover:border-emerald-300/60 active:scale-95 cursor-pointer'
              : 'border-stone-600/30 bg-stone-800/20'
        )}
      >
        <span className={cn(
          'text-[0.55rem] uppercase text-center transition-colors',
          slotReady ? 'text-emerald-300 font-medium' : 'text-stone-500'
        )}>
          {slotReady ? '↓ Place' : interactive ? 'Tap' : '—'}
        </span>
      </button>
    );
  };

  const renderClue = (zoneIndex: number) => {
    const clue = clues[zoneIndex];
    return (
      <div
        className={cn(
          'rounded-full px-3 py-0.5 whitespace-nowrap flex items-center justify-center',
          clue
            ? 'bg-white/95 text-stone-800 shadow-sm'
            : 'bg-stone-700/40',
        )}
      >
        <span className={cn(
          'font-bold uppercase tracking-wider text-center',
          compact ? 'text-[0.5rem]' : 'text-[0.6rem]',
          !clue && 'text-stone-500 font-normal text-[0.5rem]'
        )}>
          {clue ?? ZONE_LABELS[zoneIndex]}
        </span>
      </div>
    );
  };

  /*
   * Layout using a clean flex-based approach:
   *
   *           [TOP clue]
   * [LEFT]  [card0] [card1]  [RIGHT]
   *         [card2] [card3]
   *          [BOTTOM clue]
   *
   * LEFT and RIGHT are vertically centered between the two rows.
   * The clover emoji sits at the center intersection.
   */

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* TOP clue */}
      <div className="flex justify-center">{renderClue(0)}</div>

      {/* Main grid: LEFT | cards | RIGHT */}
      <div className="flex items-center gap-1">
        {/* LEFT clue — rotated vertically */}
        <div className="flex items-center justify-center w-7 shrink-0">
          <div className="-rotate-90 whitespace-nowrap">{renderClue(3)}</div>
        </div>

        {/* Card grid 2×2 */}
        <div className="flex flex-col gap-1 items-center">
          <div className="flex gap-1 items-center justify-center">
            {renderCardSlot(0)}
            {renderCardSlot(1)}
          </div>
          <div className="flex gap-1 items-center justify-center">
            {renderCardSlot(2)}
            {renderCardSlot(3)}
          </div>
        </div>

        {/* RIGHT clue — rotated vertically */}
        <div className="flex items-center justify-center w-7 shrink-0">
          <div className="rotate-90 whitespace-nowrap">{renderClue(1)}</div>
        </div>
      </div>

      {/* BOTTOM clue */}
      <div className="flex justify-center">{renderClue(2)}</div>
    </div>
  );
}
