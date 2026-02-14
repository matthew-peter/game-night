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
}

const PREMIUM_STYLES: Record<NonNullable<PremiumType>, { bg: string; text: string; label: string }> = {
  TW: { bg: 'bg-red-600', text: 'text-red-100', label: '3W' },
  DW: { bg: 'bg-rose-300', text: 'text-rose-700', label: '2W' },
  TL: { bg: 'bg-blue-500', text: 'text-blue-100', label: '3L' },
  DL: { bg: 'bg-sky-300', text: 'text-sky-700', label: '2L' },
};

export function ScrabbleBoard({
  cells,
  pendingPlacements,
  onCellDrop,
  onRemovePending,
  disabled = false,
}: ScrabbleBoardProps) {
  const pendingSet = useMemo(
    () => new Set(pendingPlacements.map(p => `${p.row},${p.col}`)),
    [pendingPlacements]
  );

  const pendingMap = useMemo(() => {
    const m = new Map<string, TilePlacement>();
    for (const p of pendingPlacements) {
      m.set(`${p.row},${p.col}`, p);
    }
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
    <div className="flex justify-center overflow-auto">
      <div
        className="inline-grid gap-px bg-stone-900 p-px rounded"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const cell = cells[row][col];
            const pendingTile = pendingMap.get(`${row},${col}`);
            const premium = getPremium(row, col);
            const isCenter = row === CENTER_ROW && col === CENTER_COL;
            const isEmpty = !cell && !pendingTile;

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  'w-[23px] h-[23px] sm:w-[27px] sm:h-[27px] md:w-[31px] md:h-[31px]',
                  'flex items-center justify-center relative',
                  isEmpty && (
                    premium
                      ? PREMIUM_STYLES[premium].bg
                      : isCenter
                        ? 'bg-rose-300'
                        : 'bg-emerald-800'
                  ),
                  isEmpty && !disabled && 'cursor-pointer hover:brightness-110',
                  // Occupied cells get a neutral bg so tile sits cleanly
                  !isEmpty && 'bg-emerald-800',
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
                      <span className={cn(
                        'text-[5px] sm:text-[6px] md:text-[7px] font-bold leading-none select-none',
                        PREMIUM_STYLES[premium].text,
                        'opacity-90'
                      )}>
                        {PREMIUM_STYLES[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[10px] sm:text-xs text-rose-600 font-bold">★</span>
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
