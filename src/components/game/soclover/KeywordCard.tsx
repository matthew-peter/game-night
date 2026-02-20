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
      onClick={handleClick}
      className={cn(
        'relative rounded-xl border-2 select-none transition-all duration-200 flex-shrink-0',
        cardSize,
        (onSelect) && 'cursor-pointer active:scale-95',
        selected && 'ring-2 ring-white shadow-white/30 shadow-lg scale-105',
        highlight === 'correct' && 'ring-2 ring-emerald-400 shadow-emerald-400/30 shadow-lg',
        highlight === 'incorrect' && 'ring-2 ring-red-400 shadow-red-400/30 shadow-lg',
        dimmed ? 'opacity-40' : 'opacity-100',
        'bg-gradient-to-br from-amber-50 to-amber-200 border-amber-400/70',
        className
      )}
    >
      {/* Top word — centered horizontally at top edge */}
      <div className="absolute top-0.5 inset-x-0 flex justify-center">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase text-center truncate max-w-[80%]')}>
          {top}
        </span>
      </div>

      {/* Right word — centered vertically at right edge */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center w-3">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase text-center')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {right}
        </span>
      </div>

      {/* Bottom word — centered horizontally at bottom edge */}
      <div className="absolute bottom-0.5 inset-x-0 flex justify-center">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase text-center truncate max-w-[80%]')}>
          {bottom}
        </span>
      </div>

      {/* Left word — centered vertically at left edge */}
      <div className="absolute inset-y-0 left-0 flex items-center justify-center w-3">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none uppercase text-center')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {left}
        </span>
      </div>

      {/* Rotate indicator */}
      {rotatable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <RotateCw className="w-3.5 h-3.5 text-stone-400/40" />
        </div>
      )}
    </div>
  );
}
