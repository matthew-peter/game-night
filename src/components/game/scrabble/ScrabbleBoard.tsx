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
  isMyTurn?: boolean;
}

// Premium squares — each has a gradient + text style for a rich, layered look
const PREMIUM: Record<NonNullable<PremiumType>, {
  bg: string;
  label: string;
  text: string;
}> = {
  TW: {
    bg: 'bg-gradient-to-br from-[#E55A50] to-[#C0392B]',
    label: '3W',
    text: 'text-white/80 font-bold',
  },
  DW: {
    bg: 'bg-gradient-to-br from-[#F7B8C8] to-[#EFA0B8]',
    label: '2W',
    text: 'text-[#8B2252]/70 font-bold',
  },
  TL: {
    bg: 'bg-gradient-to-br from-[#4A9CD8] to-[#2E78B0]',
    label: '3L',
    text: 'text-white/80 font-bold',
  },
  DL: {
    bg: 'bg-gradient-to-br from-[#A0D8F0] to-[#80C0E0]',
    label: '2L',
    text: 'text-[#1A5070]/60 font-bold',
  },
};

// Cell base: warm beige with a subtle inset shadow to feel like a "well"
const CELL_BASE = 'bg-gradient-to-br from-[#E4D8BC] to-[#D8CCAE] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]';

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
    <div className="w-full max-w-[min(100vw-16px,460px)] mx-auto">
      {/* Board frame — warm wood with rounded corners and deep shadow */}
      <div
        className="grid gap-[2px] p-[4px] rounded-2xl bg-gradient-to-br from-[#A08A6A] to-[#7A6548] shadow-[0_6px_24px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.1)]"
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

            // Rounded corners on the four outermost cells
            const corner =
              row === 0 && col === 0 ? 'rounded-tl-xl' :
              row === 0 && col === BOARD_SIZE - 1 ? 'rounded-tr-xl' :
              row === BOARD_SIZE - 1 && col === 0 ? 'rounded-bl-xl' :
              row === BOARD_SIZE - 1 && col === BOARD_SIZE - 1 ? 'rounded-br-xl' : '';

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  'aspect-square flex items-center justify-center rounded-[1px]',
                  corner,
                  // Base cell
                  CELL_BASE,
                  // Premium squares override the base
                  isEmpty && premium && PREMIUM[premium].bg,
                  // Center star
                  isEmpty && isCenter && !premium && 'bg-gradient-to-br from-[#F7B8C8] to-[#EFA0B8]',
                  // Hover highlight
                  canPlace && 'cursor-pointer hover:brightness-[0.93] hover:shadow-[inset_0_0_4px_rgba(0,0,0,0.12)] transition-all',
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
                        'text-[8px] sm:text-[10px] leading-none select-none',
                        PREMIUM[premium].text,
                      )}>
                        {PREMIUM[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[12px] sm:text-sm text-[#8B2252]/50 select-none">★</span>
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
