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
    <div className="flex items-center justify-center gap-[6px] py-2 px-2">
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
        <div key={`e-${i}`} className="w-[44px] h-[44px] sm:w-12 sm:h-12 rounded border border-dashed border-stone-300" />
      ))}
    </div>
  );
}
