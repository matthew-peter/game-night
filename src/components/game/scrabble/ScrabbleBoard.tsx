'use client';

import { useCallback, useRef } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { PlacedTile, TilePlacement, BOARD_SIZE, CENTER_ROW, CENTER_COL, PremiumType } from '@/lib/game/scrabble/types';
import { getPremium } from '@/lib/game/scrabble/board';

interface ScrabbleBoardProps {
  cells: (PlacedTile | null)[][];
  pendingPlacements: TilePlacement[];
  onCellDrop: (row: number, col: number) => void;
  onRemovePending: (row: number, col: number) => void;
  disabled?: boolean;
}

const PREMIUM_COLORS: Record<NonNullable<PremiumType>, string> = {
  TW: 'bg-red-600 text-white',
  DW: 'bg-pink-300 text-pink-800',
  TL: 'bg-blue-600 text-white',
  DL: 'bg-sky-200 text-sky-700',
};

const PREMIUM_LABELS: Record<NonNullable<PremiumType>, string> = {
  TW: 'TW',
  DW: 'DW',
  TL: 'TL',
  DL: 'DL',
};

export function ScrabbleBoard({
  cells,
  pendingPlacements,
  onCellDrop,
  onRemovePending,
  disabled = false,
}: ScrabbleBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pendingSet = new Set(pendingPlacements.map(p => `${p.row},${p.col}`));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((row: number, col: number, e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (cells[row][col] !== null) return; // Can't drop on occupied cell
    if (pendingSet.has(`${row},${col}`)) return; // Already has a pending tile
    onCellDrop(row, col);
  }, [cells, pendingSet, onCellDrop, disabled]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (disabled) return;
    // If there's a pending tile here, remove it
    if (pendingSet.has(`${row},${col}`)) {
      onRemovePending(row, col);
      return;
    }
    // If empty and we have a selected tile from rack, place it
    if (cells[row][col] === null) {
      onCellDrop(row, col);
    }
  }, [cells, pendingSet, onCellDrop, onRemovePending, disabled]);

  return (
    <div className="flex justify-center overflow-auto">
      <div
        ref={boardRef}
        className="inline-grid gap-[1px] bg-amber-900 p-[1px] rounded-sm"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const cell = cells[row][col];
            const pendingTile = pendingPlacements.find(
              p => p.row === row && p.col === col
            );
            const premium = getPremium(row, col);
            const isCenter = row === CENTER_ROW && col === CENTER_COL;

            return (
              <div
                key={`${row}-${col}`}
                className={`
                  w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] md:w-[32px] md:h-[32px]
                  flex items-center justify-center relative
                  ${cell
                    ? '' // Occupied cell — tile will render on top
                    : pendingTile
                      ? '' // Pending tile
                      : premium
                        ? PREMIUM_COLORS[premium]
                        : isCenter
                          ? 'bg-pink-300'
                          : 'bg-green-800'
                  }
                  ${!cell && !pendingTile && !disabled ? 'cursor-pointer hover:brightness-110' : ''}
                `}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(row, col, e)}
                onClick={() => handleCellClick(row, col)}
              >
                {cell ? (
                  <ScrabbleTile
                    letter={cell.letter}
                    isBlank={cell.isBlank}
                    isOnBoard
                    size="sm"
                  />
                ) : pendingTile ? (
                  <ScrabbleTile
                    letter={pendingTile.letter}
                    isBlank={pendingTile.isBlank}
                    isOnBoard
                    isNewlyPlaced
                    size="sm"
                    onClick={disabled ? undefined : () => onRemovePending(row, col)}
                  />
                ) : (
                  <>
                    {premium && (
                      <span className="text-[6px] sm:text-[7px] font-bold leading-none opacity-80">
                        {PREMIUM_LABELS[premium]}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[10px] text-pink-700">★</span>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
