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
        // Letter sits upper-center, value in bottom-right
        'justify-center',
        isBoard ? 'items-start pt-[1px]' : 'items-start pt-[5px] sm:pt-[6px]',

        // ── Size ──
        isBoard
          ? 'w-full h-full rounded-[2px]'
          : 'w-[46px] h-[46px] sm:w-[52px] sm:h-[52px] rounded-lg',

        // ── Font — board is lighter weight, rack is bold ──
        isBoard
          ? 'text-[16px] sm:text-[18px] font-semibold'
          : 'text-[21px] sm:text-[23px] font-bold',

        // ── Surface ──
        variant === 'board'
          ? 'bg-gradient-to-b from-[#FAEFD4] to-[#E8D8B4] text-[#3B2F1E] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.2)]'
          : variant === 'board-pending'
            ? 'bg-gradient-to-b from-[#FFF8E1] to-[#F0E0B0] text-[#3B2F1E] ring-2 ring-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
            : 'bg-gradient-to-b from-[#FAEFD4] to-[#E0CDA6] text-[#3B2F1E] shadow-[0_3px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]',

        // Blank
        isBlank && 'text-stone-400',

        // Selected (rack)
        isSelected && 'ring-2 ring-emerald-500 scale-[1.08] shadow-[0_4px_12px_rgba(16,185,129,0.3)] z-10',

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
          'absolute font-semibold leading-none text-[#9E8B6E]',
          isBoard
            ? 'bottom-[1px] right-[2px] text-[9px] sm:text-[10px]'
            : 'bottom-[4px] right-[5px] text-[10px] sm:text-[12px]'
        )}>
          {value}
        </span>
      )}
    </div>
  );
}
