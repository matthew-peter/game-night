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

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDragIndex(index);
    onDragStart(index, e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragIndex(null);
    onDragEnd(e);
  };

  return (
    <div className="flex items-center justify-center gap-[6px] py-2 px-3">
      {tiles.map((tile, index) => {
        const isBlank = tile === '_';
        const isSelected = selectedIndices.has(index);
        const isDragging = dragIndex === index;

        return (
          <ScrabbleTile
            key={`rack-${index}-${tile}-${isSelected}`}
            letter={isBlank ? '' : tile}
            isBlank={isBlank}
            isSelected={isSelected}
            isDragging={isDragging}
            size="rack"
            onClick={disabled ? undefined : () => onTileClick(index)}
            onDragStart={disabled || mode === 'exchange' ? undefined : (e) => handleDragStart(index, e)}
            onDragEnd={handleDragEnd}
          />
        );
      })}
      {/* Empty slot placeholders */}
      {Array.from({ length: Math.max(0, RACK_SIZE - tiles.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] rounded-[2px] border border-dashed border-stone-700/40"
        />
      ))}
    </div>
  );
}
