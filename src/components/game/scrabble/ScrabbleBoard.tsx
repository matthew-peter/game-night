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

// Vivid, classic Scrabble colors
const PREMIUM: Record<NonNullable<PremiumType>, { cell: string; label: string; text: string }> = {
  TW: { cell: 'bg-[#D4453A]', label: '3×W', text: 'text-white/90' },
  DW: { cell: 'bg-[#F0A0B8]', label: '2×W', text: 'text-[#7D1F3E]' },
  TL: { cell: 'bg-[#3486C0]', label: '3×L', text: 'text-white/90' },
  DL: { cell: 'bg-[#8DC8E8]', label: '2×L', text: 'text-[#184060]' },
};

export function ScrabbleBoard({
  cells,
  pendingPlacements,
  onCellDrop,
  onRemovePending,
  disabled = false,
  hasSelectedTile = false,
  isMyTurn = false,
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
      {/* Board frame — golden when your turn, muted when waiting */}
      <div
        className={cn(
          'grid gap-[1.5px] p-[2.5px] rounded transition-colors duration-300',
          isMyTurn
            ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
            : 'bg-[#9E8B6E]',
        )}
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
                  // Base: warm sandy beige
                  'bg-[#DDD0B2]',
                  // Premium square colors — vivid
                  isEmpty && premium && PREMIUM[premium].cell,
                  // Center star
                  isEmpty && isCenter && !premium && 'bg-[#F0A0B8]',
                  // Hover when a tile is selected
                  canPlace && 'cursor-pointer hover:brightness-[0.92] transition-colors',
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
                        'text-[8px] sm:text-[10px] font-extrabold leading-none select-none',
                        PREMIUM[premium].text,
                      )}>
                        {PREMIUM[premium].label}
                      </span>
                    )}
                    {isCenter && !premium && (
                      <span className="text-[11px] sm:text-sm text-[#7D1F3E] font-bold select-none">★</span>
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
