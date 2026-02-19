'use client';

import { cn } from '@/lib/utils';
import { KeywordCard } from './KeywordCard';
import { KeywordCardWords } from '@/lib/game/soclover/types';
import { Clover } from 'lucide-react';

interface CloverBoardProps {
  cards: KeywordCardWords[];
  placements: (number | null)[];
  rotations: number[];
  clues: (string | null)[];
  onDrop?: (position: number) => void;
  onRotate?: (position: number) => void;
  onRemove?: (position: number) => void;
  highlights?: ('correct' | 'incorrect' | null)[];
  interactive?: boolean;
  compact?: boolean;
}

const ZONE_LABELS = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];

export function CloverBoard({
  cards,
  placements,
  rotations,
  clues,
  onDrop,
  onRotate,
  onRemove,
  highlights,
  interactive = false,
  compact = false,
}: CloverBoardProps) {
  const handleDragOver = (e: React.DragEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (position: number, e: React.DragEvent) => {
    if (!interactive) return;
    e.preventDefault();
    onDrop?.(position);
  };

  const cardSize = compact ? 'sm' as const : 'md' as const;
  const slotSize = compact ? 'w-[5rem] h-[5rem]' : 'w-[6rem] h-[6rem]';

  const renderCardSlot = (position: number) => {
    const cardIdx = placements[position];
    const hasCard = cardIdx != null;
    const highlight = highlights?.[position] ?? null;

    if (hasCard) {
      return (
        <div className="relative group">
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
              onClick={() => onRemove?.(position)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                         shadow-md hover:bg-red-400 z-10"
            >
              ×
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(position, e)}
        className={cn(
          slotSize,
          'rounded-xl border-2 border-dashed flex items-center justify-center transition-colors',
          interactive
            ? 'border-emerald-500/40 bg-emerald-900/20 hover:bg-emerald-900/40 hover:border-emerald-400/60'
            : 'border-stone-600/40 bg-stone-800/30'
        )}
      >
        <span className="text-[0.6rem] text-stone-500">
          {interactive ? 'Drop' : '—'}
        </span>
      </div>
    );
  };

  const renderClueZone = (zoneIndex: number) => {
    const clue = clues[zoneIndex];
    return (
      <div
        className={cn(
          'rounded-full px-3 py-0.5 text-center max-w-full',
          clue
            ? 'bg-white/90 text-stone-800 shadow-sm'
            : 'bg-stone-700/50',
        )}
      >
        <span className={cn(
          'font-bold uppercase tracking-wider',
          compact ? 'text-[0.5rem]' : 'text-[0.6rem]',
          !clue && 'text-stone-500 font-normal lowercase'
        )}>
          {clue ?? ZONE_LABELS[zoneIndex]}
        </span>
      </div>
    );
  };

  /*
   * Layout: 3×3 grid
   *
   *          [TOP clue]
   *  [card0]  [clover]  [card1]
   * [LEFT]              [RIGHT]
   *  [card2]            [card3]
   *         [BOTTOM clue]
   *
   * Using a 3-col, 3-row grid with clue zones positioned between.
   */

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Top clue zone */}
      <div className="flex justify-center">
        {renderClueZone(0)}
      </div>

      {/* Middle row: card0 | center | card1, with LEFT and RIGHT clues */}
      <div className="flex items-center gap-1">
        {/* LEFT clue */}
        <div className="flex items-center justify-center w-8">
          <div className="-rotate-90">
            {renderClueZone(3)}
          </div>
        </div>

        {/* Card 0 */}
        {renderCardSlot(0)}

        {/* Center clover icon */}
        <div className="flex items-center justify-center w-6">
          <Clover className="w-4 h-4 text-emerald-500/50" />
        </div>

        {/* Card 1 */}
        {renderCardSlot(1)}

        {/* RIGHT clue */}
        <div className="flex items-center justify-center w-8">
          <div className="rotate-90">
            {renderClueZone(1)}
          </div>
        </div>
      </div>

      {/* Bottom row: card2 | gap | card3 */}
      <div className="flex items-center gap-1">
        <div className="w-8" />
        {renderCardSlot(2)}
        <div className="w-6" />
        {renderCardSlot(3)}
        <div className="w-8" />
      </div>

      {/* Bottom clue zone */}
      <div className="flex justify-center">
        {renderClueZone(2)}
      </div>
    </div>
  );
}
