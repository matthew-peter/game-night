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
    <div className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-900/60 rounded-xl border border-amber-800/40">
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
            size="lg"
            onClick={disabled ? undefined : () => onTileClick(index)}
            onDragStart={disabled || mode === 'exchange' ? undefined : (e) => handleDragStart(index, e)}
            onDragEnd={handleDragEnd}
          />
        );
      })}
      {/* Fill empty slots to maintain consistent rack width */}
      {Array.from({ length: Math.max(0, RACK_SIZE - tiles.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="w-11 h-11 rounded-[3px] border-2 border-dashed border-amber-700/30"
        />
      ))}
    </div>
  );
}
