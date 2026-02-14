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
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] md:w-[30px] md:h-[30px] text-[10px] sm:text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
} as const;

const SUBSCRIPT_SIZE = {
  sm: 'text-[5px] sm:text-[6px]',
  md: 'text-[8px]',
  lg: 'text-[10px]',
} as const;

export function ScrabbleTile({
  letter,
  isBlank = false,
  isOnBoard = false,
  isNewlyPlaced = false,
  isSelected = false,
  isDragging = false,
  size = 'md',
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
        SIZE_CLASSES[size],
        'relative inline-flex items-center justify-center select-none',
        'rounded-[3px] font-bold uppercase',
        // Tile appearance: warm parchment look
        isOnBoard
          ? isNewlyPlaced
            ? 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-400 shadow-sm ring-1 ring-amber-400/50'
            : 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200/80'
          : 'bg-gradient-to-br from-amber-50 to-amber-200 border border-amber-300 shadow-md hover:shadow-lg',
        // Selection ring
        isSelected && 'ring-2 ring-blue-500 ring-offset-1 ring-offset-stone-800',
        // Dragging
        isDragging && 'opacity-40 scale-95',
        // Blank tiles in a distinct color
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
          'absolute bottom-px right-0.5 font-semibold leading-none text-stone-500',
          SUBSCRIPT_SIZE[size]
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
