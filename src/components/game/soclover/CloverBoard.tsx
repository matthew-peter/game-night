'use client';

import { cn } from '@/lib/utils';
import { KeywordCard } from './KeywordCard';
import { Clover } from 'lucide-react';

interface CloverBoardProps {
  cards: [string, string][];
  placements: (number | null)[];
  orientations: boolean[];
  clues: (string | null)[];
  onDrop?: (position: number) => void;
  onFlip?: (position: number) => void;
  onRemove?: (position: number) => void;
  highlights?: ('correct' | 'incorrect' | null)[];
  interactive?: boolean;
  compact?: boolean;
}

const ZONE_LABELS = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];

export function CloverBoard({
  cards,
  placements,
  orientations,
  clues,
  onDrop,
  onFlip,
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
  const cellBase = compact ? 'w-[4.5rem] h-[3.5rem]' : 'w-[5.5rem] h-[4.5rem]';
  const clueCell = compact ? 'min-h-[1.5rem]' : 'min-h-[2rem]';

  const renderCardSlot = (position: number) => {
    const cardIdx = placements[position];
    const hasCard = cardIdx != null;
    const highlight = highlights?.[position] ?? null;

    if (hasCard) {
      return (
        <div className="relative group">
          <KeywordCard
            words={cards[cardIdx]}
            orientation={orientations[position]}
            flippable={interactive}
            onFlip={() => onFlip?.(position)}
            highlight={highlight}
            size={cardSize}
          />
          {interactive && (
            <button
              onClick={() => onRemove?.(position)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                         shadow-md hover:bg-red-400"
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
          cellBase,
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

  const renderClueZone = (zoneIndex: number, direction: 'horizontal' | 'vertical') => {
    const clue = clues[zoneIndex];
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          clueCell,
          direction === 'horizontal' ? 'col-span-2' : 'row-span-2',
        )}
      >
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
            compact ? 'text-[0.55rem]' : 'text-[0.65rem]',
            !clue && 'text-stone-500 font-normal lowercase'
          )}>
            {clue ?? ZONE_LABELS[zoneIndex]}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        'grid gap-1',
        'grid-cols-[auto_1fr_auto_1fr_auto]',
        'grid-rows-[auto_1fr_auto_1fr_auto]',
        'items-center justify-items-center'
      )}>
        {/* Row 0: empty | TOP clue (spans 2) | empty */}
        <div />
        <div className="col-span-3 flex justify-center">
          {renderClueZone(0, 'horizontal')}
        </div>
        <div />

        {/* Row 1: LEFT clue (top half) | Card 0 | center | Card 1 | RIGHT clue (top half) */}
        <div className="row-span-1 flex items-center justify-center">
          {/* LEFT clue rendered spanning rows */}
        </div>
        <div className="col-span-1 flex justify-center">
          {renderCardSlot(0)}
        </div>
        <div className="flex items-center justify-center w-8 h-8">
          <Clover className="w-5 h-5 text-emerald-500/60" />
        </div>
        <div className="col-span-1 flex justify-center">
          {renderCardSlot(1)}
        </div>
        <div className="row-span-1 flex items-center justify-center">
          {/* RIGHT clue rendered spanning rows */}
        </div>

        {/* Row 2: LEFT clue (rendered here) | center divider | RIGHT clue */}
        <div className="flex items-center justify-center">
          {renderClueZone(3, 'vertical')}
        </div>
        <div />
        <div />
        <div />
        <div className="flex items-center justify-center">
          {renderClueZone(1, 'vertical')}
        </div>

        {/* Row 3: LEFT clue (bottom half) | Card 2 | center | Card 3 | RIGHT clue (bottom half) */}
        <div />
        <div className="col-span-1 flex justify-center">
          {renderCardSlot(2)}
        </div>
        <div className="w-8" />
        <div className="col-span-1 flex justify-center">
          {renderCardSlot(3)}
        </div>
        <div />

        {/* Row 4: empty | BOTTOM clue (spans 2) | empty */}
        <div />
        <div className="col-span-3 flex justify-center">
          {renderClueZone(2, 'horizontal')}
        </div>
        <div />
      </div>
    </div>
  );
}
