'use client';

import { cn } from '@/lib/utils';
import { KeywordCardWords, getRotatedWords } from '@/lib/game/soclover/types';
import { RotateCw } from 'lucide-react';

interface KeywordCardProps {
  words: KeywordCardWords;
  rotation: number;
  rotatable?: boolean;
  onRotate?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  highlight?: 'correct' | 'incorrect' | null;
  size?: 'sm' | 'md';
  dimmed?: boolean;
  className?: string;
}

export function KeywordCard({
  words,
  rotation,
  rotatable = false,
  onRotate,
  selected = false,
  onSelect,
  draggable = false,
  onDragStart,
  highlight = null,
  size = 'md',
  dimmed = false,
  className,
}: KeywordCardProps) {
  const [top, right, bottom, left] = getRotatedWords(words, rotation);
  const isSmall = size === 'sm';
  const cardSize = isSmall ? 'w-[4.75rem] h-[4.75rem]' : 'w-[5.5rem] h-[5.5rem]';
  const fontSize = isSmall ? 'text-[0.45rem]' : 'text-[0.5rem]';

  const handleClick = () => {
    if (onSelect) {
      onSelect();
    } else if (rotatable && onRotate) {
      onRotate();
    }
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={handleClick}
      className={cn(
        'relative rounded-xl border-2 select-none transition-all duration-200 flex-shrink-0',
        cardSize,
        (onSelect || draggable) && 'cursor-pointer active:scale-95',
        selected && 'ring-2 ring-white shadow-white/30 shadow-lg scale-105',
        highlight === 'correct' && 'ring-2 ring-emerald-400 shadow-emerald-400/30 shadow-lg',
        highlight === 'incorrect' && 'ring-2 ring-red-400 shadow-red-400/30 shadow-lg',
        dimmed ? 'opacity-40' : 'opacity-100',
        'bg-gradient-to-br from-amber-50 to-amber-200 border-amber-400/70',
        className
      )}
    >
      {/* Top word */}
      <div className="absolute top-1 left-1 right-1 flex justify-center overflow-hidden">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase truncate')}>{top}</span>
      </div>

      {/* Right word — vertical */}
      <div className="absolute top-1 bottom-1 right-0.5 flex items-center overflow-hidden">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {right}
        </span>
      </div>

      {/* Bottom word */}
      <div className="absolute bottom-1 left-1 right-1 flex justify-center overflow-hidden">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase truncate')}>{bottom}</span>
      </div>

      {/* Left word — vertical */}
      <div className="absolute top-1 bottom-1 left-0.5 flex items-center overflow-hidden">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {left}
        </span>
      </div>

      {/* Rotate indicator (only when card is placed and rotatable) */}
      {rotatable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <RotateCw className="w-3.5 h-3.5 text-stone-400/40" />
        </div>
      )}
    </div>
  );
}
