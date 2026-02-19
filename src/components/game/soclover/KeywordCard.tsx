'use client';

import { cn } from '@/lib/utils';
import { KeywordCardWords, getRotatedWords } from '@/lib/game/soclover/types';
import { RotateCw } from 'lucide-react';

interface KeywordCardProps {
  words: KeywordCardWords;
  rotation: number;
  rotatable?: boolean;
  onRotate?: () => void;
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
  draggable = false,
  onDragStart,
  highlight = null,
  size = 'md',
  dimmed = false,
  className,
}: KeywordCardProps) {
  const [top, right, bottom, left] = getRotatedWords(words, rotation);
  const isSmall = size === 'sm';
  const cardSize = isSmall ? 'w-[5rem] h-[5rem]' : 'w-[6rem] h-[6rem]';
  const fontSize = isSmall ? 'text-[0.5rem]' : 'text-[0.55rem]';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        'relative rounded-xl border-2 select-none transition-all duration-200',
        cardSize,
        draggable && 'cursor-grab active:cursor-grabbing active:scale-105 hover:shadow-lg',
        highlight === 'correct' && 'ring-2 ring-emerald-400 shadow-emerald-400/30 shadow-lg',
        highlight === 'incorrect' && 'ring-2 ring-red-400 shadow-red-400/30 shadow-lg animate-shake',
        dimmed ? 'opacity-40' : 'opacity-100',
        'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-400/60',
        className
      )}
    >
      {/* Top word */}
      <div className="absolute top-0.5 left-0 right-0 flex justify-center">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none')}>{top}</span>
      </div>

      {/* Right word */}
      <div className="absolute top-0 bottom-0 right-0.5 flex items-center">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {right}
        </span>
      </div>

      {/* Bottom word */}
      <div className="absolute bottom-0.5 left-0 right-0 flex justify-center">
        <span className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none')}>{bottom}</span>
      </div>

      {/* Left word */}
      <div className="absolute top-0 bottom-0 left-0.5 flex items-center">
        <span
          className={cn(fontSize, 'font-bold text-stone-700 tracking-wide leading-none')}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {left}
        </span>
      </div>

      {/* Rotate button */}
      {rotatable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRotate?.(); }}
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100
                     transition-opacity bg-stone-900/20 rounded-xl"
        >
          <RotateCw className="w-4 h-4 text-white drop-shadow" />
        </button>
      )}
    </div>
  );
}
