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
        'relative inline-flex select-none uppercase',

        // ── Size ──
        isBoard
          ? 'w-full h-full rounded-[2px] items-center justify-center'
          : 'w-[50px] h-[50px] sm:w-14 sm:h-14 rounded-xl items-center justify-center',

        // ── Surface ──
        variant === 'board'
          ? 'bg-gradient-to-b from-[#FAEFD4] to-[#E8D8B4] text-[#3B2F1E] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.2)]'
          : variant === 'board-pending'
            ? 'bg-gradient-to-b from-[#FFF8E1] to-[#F0E0B0] text-[#3B2F1E] ring-2 ring-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
            : 'bg-gradient-to-b from-[#FAF0D8] to-[#E6D4AA] text-[#3B2F1E] shadow-[0_3px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] border border-[#D4C4A0]',

        // Blank
        isBlank && 'text-stone-400',

        // Selected (rack)
        isSelected && 'ring-2 ring-emerald-500 scale-[1.08] shadow-[0_4px_14px_rgba(16,185,129,0.3)] z-10',

        // Dragging
        isDragging && 'opacity-30 scale-90',

        // Interactive
        onClick && 'cursor-pointer active:scale-95',
        onDragStart && 'cursor-grab active:cursor-grabbing',

        'transition-all duration-75',
      )}
    >
      {/* Letter + value laid out together so they scale as one unit */}
      <span className={cn(
        'leading-none font-bold',
        isBoard ? 'text-[17px] sm:text-[19px]' : 'text-[24px] sm:text-[28px]',
      )}>
        {letter || ''}
      </span>
      {value > 0 && (
        <span className={cn(
          'absolute font-semibold leading-none text-[#A0896A]',
          isBoard
            ? 'bottom-[0px] right-[1px] text-[9px] sm:text-[11px]'
            : 'bottom-[5px] right-[5px] sm:bottom-[6px] sm:right-[6px] text-[12px] sm:text-[14px]'
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
