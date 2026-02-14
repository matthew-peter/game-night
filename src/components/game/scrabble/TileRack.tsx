'use client';

import { useState } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { TileLetter, RACK_SIZE } from '@/lib/game/scrabble/types';

interface TileRackProps {
  tiles: TileLetter[];
  selectedIndices: Set<number>;
  onTileClick: (index: number) => void;
  onDragStart: (index: number, e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  disabled?: boolean;
  mode: 'play' | 'exchange';
}

export function TileRack({
  tiles,
  selectedIndices,
  onTileClick,
  onDragStart,
  onDragEnd,
  disabled = false,
  mode,
}: TileRackProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="mx-2 bg-gradient-to-b from-[#5C3D1E] to-[#4A3018] rounded-xl px-2 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-center gap-[6px]">
        {tiles.map((tile, index) => (
          <ScrabbleTile
            key={`rack-${index}-${tile}-${selectedIndices.has(index)}`}
            letter={tile === '_' ? '' : tile}
            isBlank={tile === '_'}
            isSelected={selectedIndices.has(index)}
            isDragging={dragIndex === index}
            variant="rack"
            onClick={disabled ? undefined : () => onTileClick(index)}
            onDragStart={disabled || mode === 'exchange' ? undefined : (e) => {
              setDragIndex(index);
              onDragStart(index, e);
            }}
            onDragEnd={(e) => {
              setDragIndex(null);
              onDragEnd(e);
            }}
          />
        ))}
        {Array.from({ length: Math.max(0, RACK_SIZE - tiles.length) }).map((_, i) => (
          <div key={`e-${i}`} className="w-[46px] h-[46px] sm:w-[52px] sm:h-[52px] rounded-lg border border-dashed border-white/10" />
        ))}
      </div>
    </div>
  );
}
