'use client';

import { cn } from '@/lib/utils';

interface KeywordCardProps {
  words: [string, string];
  orientation: boolean;
  flippable?: boolean;
  onFlip?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  highlight?: 'correct' | 'incorrect' | null;
  size?: 'sm' | 'md';
  dimmed?: boolean;
  className?: string;
}

export function KeywordCard({
  words,
  orientation,
  flippable = false,
  onFlip,
  draggable = false,
  onDragStart,
  highlight = null,
  size = 'md',
  dimmed = false,
  className,
}: KeywordCardProps) {
  const [top, bottom] = orientation ? words : [words[1], words[0]];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={flippable ? onFlip : undefined}
      className={cn(
        'rounded-xl border-2 flex flex-col items-center justify-center select-none transition-all duration-200',
        size === 'md' ? 'w-[5.5rem] h-[4.5rem] text-[0.65rem]' : 'w-[4.5rem] h-[3.5rem] text-[0.55rem]',
        draggable && 'cursor-grab active:cursor-grabbing active:scale-105 hover:shadow-lg',
        flippable && 'cursor-pointer hover:ring-2 hover:ring-emerald-400/50',
        highlight === 'correct' && 'ring-2 ring-emerald-400 shadow-emerald-400/30 shadow-lg',
        highlight === 'incorrect' && 'ring-2 ring-red-400 shadow-red-400/30 shadow-lg animate-shake',
        dimmed ? 'opacity-40' : 'opacity-100',
        'bg-gradient-to-b from-amber-100 to-amber-200 border-amber-400/60 text-stone-800',
        className
      )}
    >
      <span className="font-bold tracking-wide leading-tight text-center px-1">{top}</span>
      <div className="w-8 h-px bg-amber-400/50 my-0.5" />
      <span className="font-bold tracking-wide leading-tight text-center px-1">{bottom}</span>
    </div>
  );
}
