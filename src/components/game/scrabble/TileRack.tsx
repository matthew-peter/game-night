'use client';

import { useState } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { TileLetter } from '@/lib/game/scrabble/types';

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
    <div className="flex items-center justify-center gap-1 py-2 px-3 bg-amber-900/80 rounded-lg">
      {tiles.map((tile, index) => {
        const isBlank = tile === '_';
        const isSelected = selectedIndices.has(index);
        const isDragging = dragIndex === index;

        return (
          <ScrabbleTile
            key={`${index}-${tile}`}
            letter={isBlank ? '' : tile}
            isBlank={isBlank}
            isSelected={isSelected}
            isDragging={isDragging}
            size="lg"
            onClick={disabled ? undefined : () => onTileClick(index)}
            onDragStart={disabled || mode === 'exchange' ? undefined : (e) => handleDragStart(index, e)}
            onDragEnd={handleDragEnd}
          />
        );
      })}
      {/* Fill empty slots */}
      {Array.from({ length: Math.max(0, 7 - tiles.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="w-11 h-11 rounded-sm border-2 border-dashed border-amber-700/40"
        />
      ))}
    </div>
  );
}
