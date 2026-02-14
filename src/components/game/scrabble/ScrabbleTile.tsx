'use client';

import { getTileValue } from '@/lib/game/scrabble/tiles';
import { cn } from '@/lib/utils';

interface ScrabbleTileProps {
  letter: string;
  isBlank?: boolean;
  /** board = placed on board, board-pending = just placed (removable), rack = in player's rack */
  variant?: 'board' | 'board-pending' | 'rack';
  isSelected?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function ScrabbleTile({
  letter,
  isBlank = false,
  variant = 'rack',
  isSelected = false,
  isDragging = false,
  onClick,
  onDragStart,
  onDragEnd,
}: ScrabbleTileProps) {
  const value = isBlank ? 0 : getTileValue(letter);
  const isBoard = variant === 'board' || variant === 'board-pending';

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center select-none font-bold uppercase',

        // ── Size ──
        isBoard
          ? 'w-full h-full rounded-[1px] text-[9px] sm:text-[11px]'
          : 'w-[42px] h-[42px] sm:w-11 sm:h-11 rounded text-[15px] sm:text-[17px]',

        // ── Surface ──
        variant === 'board'
          ? 'bg-amber-100 text-stone-800'
          : variant === 'board-pending'
            ? 'bg-amber-200 text-stone-800 ring-1 ring-amber-400/80 shadow-sm shadow-amber-500/20'
            : 'bg-amber-100 text-stone-800 shadow-md border border-amber-200/60',

        // Blank tiles
        isBlank && 'text-stone-500',

        // Selected (rack only)
        isSelected && 'ring-2 ring-blue-400 scale-[1.08] shadow-lg shadow-blue-500/25 z-10',

        // Dragging
        isDragging && 'opacity-30 scale-90',

        // Interactive
        onClick && 'cursor-pointer active:scale-95',
        onDragStart && 'cursor-grab active:cursor-grabbing',

        'transition-all duration-75',
      )}
    >
      <span className={cn('leading-none', isBlank && 'italic')}>{letter || ''}</span>
      {value > 0 && (
        <span className={cn(
          'absolute font-medium leading-none text-stone-500',
          isBoard
            ? 'bottom-0 right-[1px] text-[3.5px] sm:text-[5px]'
            : 'bottom-[2px] right-[3px] text-[7px]'
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
