'use client';

import { useCallback, useMemo } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { PlacedTile, TilePlacement, BOARD_SIZE, CENTER_ROW, CENTER_COL, PremiumType } from '@/lib/game/scrabble/types';
import { getPremium } from '@/lib/game/scrabble/board';
import { cn } from '@/lib/utils';

interface ScrabbleBoardProps {
  cells: (PlacedTile | null)[][];
  pendingPlacements: TilePlacement[];
  onCellDrop: (row: number, col: number) => void;
  onRemovePending: (row: number, col: number) => void;
  disabled?: boolean;
  hasSelectedTile?: boolean;
}

// Warm, muted board-game palette
const PREMIUM_STYLES: Record<NonNullable<PremiumType>, { bg: string; text: string; label: string }> = {
  TW: { bg: 'bg-red-800',    text: 'text-red-200',    label: '3W' },
  DW: { bg: 'bg-rose-400/80', text: 'text-rose-900',   label: '2W' },
  TL: { bg: 'bg-blue-700',   text: 'text-blue-200',   label: '3L' },
  DL: { bg: 'bg-sky-400/70',  text: 'text-sky-900',    label: '2L' },
};

export function ScrabbleBoard({
  cells,
  pendingPlacements,
  onCellDrop,
  onRemovePending,
  disabled = false,
  hasSelectedTile = false,
}: ScrabbleBoardProps) {
  const pendingSet = useMemo(
    () => new Set(pendingPlacements.map(p => `${p.row},${p.col}`)),
    [pendingPlacements]
  );

  const pendingMap = useMemo(() => {
    const m = new Map<string, TilePlacement>();
    for (const p of pendingPlacements) m.set(`${p.row},${p.col}`, p);
    return m;
  }, [pendingPlacements]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((row: number, col: number, e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (cells[row][col] !== null) return;
    if (pendingSet.has(`${row},${col}`)) return;
    onCellDrop(row, col);
  }, [cells, pendingSet, onCellDrop, disabled]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (disabled) return;
    if (pendingSet.has(`${row},${col}`)) {
      onRemovePending(row, col);
      return;
    }
    if (cells[row][col] === null) {
      onCellDrop(row, col);
    }
  }, [cells, pendingSet, onCellDrop, onRemovePending, disabled]);

  return (
    <div className="w-full max-w-[min(100vw-12px,480px)] mx-auto">
      <div
        className="grid gap-[1px] bg-[#1a3a2a] p-[1px] rounded-sm"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const cell = cells[row][col];
            const pendingTile = pendingMap.get(`${row},${col}`);
            const premium = getPremium(row, col);
            const isCenter = row === CENTER_ROW && col === CENTER_COL;
            const isEmpty = !cell && !pendingTile;
            const canPlace = isEmpty && !disabled && hasSelectedTile;

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  'aspect-square flex items-center justify-center relative',
                  // Empty cell colors
                  isEmpty && (
                    premium
                      ? PREMIUM_STYLES[premium].bg
                      : isCenter
                        ? 'bg-rose-400/80'
                        : 'bg-[#4a8c5c]'
                  ),
                  // Cell with tile
                  !isEmpty && 'bg-[#4a8c5c]',
                  // Interactive states
                  canPlace && 'cursor-pointer',
                  canPlace && 'hover:brightness-125 hover:ring-1 hover:ring-amber-300/50',
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(row, col, e)}
                onClick={() => handleCellClick(row, col)}
              >
                {cell ? (
                  <ScrabbleTile
                    letter={cell.letter}
                    isBlank={cell.isBlank}
                    isOnBoard
                    size="board"
                  />
                ) : pendingTile ? (
                  <ScrabbleTile
                    letter={pendingTile.letter}
                    isBlank={pendingTile.isBlank}
                    isOnBoard
                    isNewlyPlaced
                    size="board"
                    onClick={disabled ? undefined : () => onRemovePending(row, col)}
                  />
                ) : (
                  <>
                    {premium && (
                      <span className={cn(
                        'text-[6px] sm:text-[7px] font-bold leading-none select-none pointer-events-none',
                        PREMIUM_STYLES[premium].text,
                      )}>
                        {PREMIUM_STYLES[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[9px] sm:text-[11px] text-rose-200 font-bold select-none">★</span>
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
