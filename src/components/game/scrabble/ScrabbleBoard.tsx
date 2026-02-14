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

// Dark, warm palette — premium squares are subtle tints, not garish colors
const PREMIUM: Record<NonNullable<PremiumType>, { cell: string; label: string; text: string }> = {
  TW: { cell: 'bg-red-950/60',  label: '3W', text: 'text-red-400/80' },
  DW: { cell: 'bg-rose-950/50', label: '2W', text: 'text-rose-400/70' },
  TL: { cell: 'bg-blue-950/60', label: '3L', text: 'text-blue-400/80' },
  DL: { cell: 'bg-sky-950/50',  label: '2L', text: 'text-sky-400/70' },
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
    if (disabled || cells[row][col] !== null || pendingSet.has(`${row},${col}`)) return;
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
    <div className="w-full max-w-[min(100vw-8px,460px)] mx-auto">
      <div
        className="grid gap-[0.5px] bg-stone-800/80 rounded-[3px] overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const cell = cells[row][col];
            const pending = pendingMap.get(`${row},${col}`);
            const premium = getPremium(row, col);
            const isCenter = row === CENTER_ROW && col === CENTER_COL;
            const isEmpty = !cell && !pending;
            const canPlace = isEmpty && !disabled && hasSelectedTile;

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  'aspect-square flex items-center justify-center',
                  // Base cell color — warm dark gray
                  isEmpty ? 'bg-stone-700' : 'bg-stone-700',
                  // Premium tint
                  isEmpty && premium && PREMIUM[premium].cell,
                  // Center star bg
                  isEmpty && isCenter && !premium && 'bg-rose-950/40',
                  // Hover when placeable
                  canPlace && 'cursor-pointer hover:bg-stone-600 transition-colors',
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(row, col, e)}
                onClick={() => handleCellClick(row, col)}
              >
                {cell ? (
                  <ScrabbleTile letter={cell.letter} isBlank={cell.isBlank} variant="board" />
                ) : pending ? (
                  <ScrabbleTile
                    letter={pending.letter}
                    isBlank={pending.isBlank}
                    variant="board-pending"
                    onClick={disabled ? undefined : () => onRemovePending(row, col)}
                  />
                ) : (
                  <>
                    {premium && (
                      <span className={cn(
                        'text-[5.5px] sm:text-[7px] font-semibold leading-none select-none',
                        PREMIUM[premium].text,
                      )}>
                        {PREMIUM[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[8px] sm:text-[10px] text-rose-400/60 select-none">★</span>
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
