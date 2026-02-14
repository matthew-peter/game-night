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

// Classic board-game palette — beige surface, colored premium squares
const PREMIUM: Record<NonNullable<PremiumType>, { cell: string; label: string; text: string }> = {
  TW: { cell: 'bg-[#C0392B]', label: '3W', text: 'text-white' },
  DW: { cell: 'bg-[#E8A0B4]', label: '2W', text: 'text-[#6D1F3A]' },
  TL: { cell: 'bg-[#2471A3]', label: '3L', text: 'text-white' },
  DL: { cell: 'bg-[#85C1E9]', label: '2L', text: 'text-[#154360]' },
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
      {/* Brown border frame, like a real board edge */}
      <div
        className="grid gap-[1.5px] bg-[#8B7355] p-[2px] rounded-sm"
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
                  // Base: warm beige like a real board
                  'bg-[#D4C5A0]',
                  // Premium square colors
                  isEmpty && premium && PREMIUM[premium].cell,
                  // Center star
                  isEmpty && isCenter && !premium && 'bg-[#E8A0B4]',
                  // Hover when a tile is selected
                  canPlace && 'cursor-pointer hover:brightness-95 transition-colors',
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
                        'text-[6px] sm:text-[8px] font-extrabold leading-none select-none',
                        PREMIUM[premium].text,
                      )}>
                        {PREMIUM[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[10px] sm:text-xs text-[#6D1F3A] font-bold select-none">★</span>
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
