'use client';

import { getTileValue } from '@/lib/game/scrabble/tiles';
import { cn } from '@/lib/utils';

interface ScrabbleTileProps {
  letter: string;
  isBlank?: boolean;
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
        'relative inline-flex items-center justify-center select-none uppercase',

        // ── Size ──
        isBoard
          ? 'w-full h-full rounded-[1px]'
          : 'w-[42px] h-[42px] sm:w-11 sm:h-11 rounded',

        // ── Font ──
        isBoard
          ? 'text-[13px] sm:text-[15px] font-extrabold'
          : 'text-[16px] sm:text-[18px] font-bold',

        // ── Surface — cream tiles stand out against beige board ──
        variant === 'board'
          ? 'bg-[#F7ECCE] text-[#3B2F1E] border border-[#C9B88A] shadow-[inset_0_1px_0_#fff,0_1px_1px_rgba(0,0,0,0.15)]'
          : variant === 'board-pending'
            ? 'bg-[#FFF8E1] text-[#3B2F1E] border-2 border-amber-500 shadow-[0_0_4px_rgba(245,180,50,0.4)]'
            : 'bg-[#F7ECCE] text-[#3B2F1E] border border-[#C9B88A] shadow-md',

        // Blank
        isBlank && 'text-stone-400',

        // Selected (rack)
        isSelected && 'ring-2 ring-blue-500 scale-[1.08] shadow-lg z-10',

        // Dragging
        isDragging && 'opacity-30 scale-90',

        // Interactive
        onClick && 'cursor-pointer active:scale-95',
        onDragStart && 'cursor-grab active:cursor-grabbing',

        'transition-all duration-75',
      )}
    >
      <span className="leading-none">{letter || ''}</span>
      {value > 0 && (
        <span className={cn(
          'absolute font-bold leading-none text-[#8B7355]',
          isBoard
            ? 'bottom-[1px] right-[2px] text-[7px] sm:text-[8px]'
            : 'bottom-[2px] right-[3px] text-[8px]'
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
