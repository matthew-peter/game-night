'use client';

import { getTileValue } from '@/lib/game/scrabble/tiles';

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

  const sizeClasses = {
    sm: 'w-[22px] h-[22px] text-[10px]',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const subscriptSize = {
    sm: 'text-[6px]',
    md: 'text-[8px]',
    lg: 'text-[10px]',
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        ${sizeClasses[size]}
        relative inline-flex items-center justify-center
        rounded-sm font-bold uppercase select-none
        ${isOnBoard
          ? isNewlyPlaced
            ? 'bg-amber-200 border-amber-400 border shadow-sm'
            : 'bg-amber-100 border-amber-300 border'
          : 'bg-amber-100 border-amber-300 border shadow-md hover:shadow-lg'
        }
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${isDragging ? 'opacity-50' : ''}
        ${isBlank ? 'text-red-700' : 'text-stone-800'}
        ${onClick ? 'cursor-pointer active:scale-95' : ''}
        ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''}
        transition-all duration-100
        ${className}
      `}
    >
      <span className={isBlank ? 'italic' : ''}>{letter || ''}</span>
      {value > 0 && (
        <span className={`absolute bottom-0 right-0.5 ${subscriptSize[size]} text-stone-500 font-normal leading-none`}>
          {value}
        </span>
      )}
    </div>
  );
}
