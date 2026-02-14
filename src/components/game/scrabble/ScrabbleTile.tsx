'use client';

import { getTileValue } from '@/lib/game/scrabble/tiles';
import { cn } from '@/lib/utils';

interface ScrabbleTileProps {
  letter: string;
  isBlank?: boolean;
  isOnBoard?: boolean;
  isNewlyPlaced?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  size?: 'board' | 'rack';
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
}

export function ScrabbleTile({
  letter,
  isBlank = false,
  isOnBoard = false,
  isNewlyPlaced = false,
  isSelected = false,
  isDragging = false,
  size = 'rack',
  onClick,
  onDragStart,
  onDragEnd,
  className = '',
}: ScrabbleTileProps) {
  const value = isBlank ? 0 : getTileValue(letter);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center select-none',
        'rounded-[2px] font-bold uppercase',

        // ── Size ──
        size === 'board'
          ? 'w-full h-full text-[9px] sm:text-[11px]'
          : 'w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] text-base sm:text-lg',

        // ── Tile surface ──
        isOnBoard
          ? isNewlyPlaced
            ? 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-500 shadow-sm'
            : 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300/60'
          : 'bg-gradient-to-br from-amber-50 to-amber-200 border border-amber-400/80 shadow-md',

        // Selection
        isSelected && 'ring-2 ring-blue-400 ring-offset-1 ring-offset-stone-900 scale-105 shadow-lg shadow-blue-500/20',

        // Dragging
        isDragging && 'opacity-30 scale-90',

        // Blank tiles get a slightly different text color
        isBlank ? 'text-rose-600' : 'text-stone-800',

        // Interactivity
        onClick && 'cursor-pointer active:scale-95',
        onDragStart && 'cursor-grab active:cursor-grabbing',

        'transition-all duration-100',
        className
      )}
    >
      <span className={cn(isBlank && 'italic', 'leading-none')}>{letter || ''}</span>
      {value > 0 && (
        <span className={cn(
          'absolute font-semibold leading-none text-stone-500',
          size === 'board'
            ? 'bottom-0 right-[1px] text-[4px] sm:text-[5px]'
            : 'bottom-[2px] right-[3px] text-[7px] sm:text-[8px]'
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
