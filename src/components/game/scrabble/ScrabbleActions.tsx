'use client';

import { cn } from '@/lib/utils';
import { Play, ArrowLeftRight, SkipForward, RotateCcw, Search } from 'lucide-react';

interface ScrabbleActionsProps {
  isMyTurn: boolean;
  hasPendingTiles: boolean;
  selectedRackCount: number;
  mode: 'play' | 'exchange';
  onPlay: () => void;
  onExchange: () => void;
  onPass: () => void;
  onRecall: () => void;
  onToggleMode: () => void;
  onCheckWord?: () => void;
  isSubmitting: boolean;
  tilesInBag: number;
  dictionaryMode: string;
}

function ActionButton({
  onClick,
  disabled,
  variant = 'secondary',
  children,
  className,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'muted';
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:scale-95',
        variant === 'primary' && 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
        variant === 'secondary' && 'bg-stone-700 hover:bg-stone-600 text-stone-200 border border-stone-600',
        variant === 'muted' && 'bg-stone-700/50 hover:bg-stone-600/50 text-stone-400 border border-stone-700',
        className
      )}
    >
      {children}
    </button>
  );
}

export function ScrabbleActions({
  isMyTurn,
  hasPendingTiles,
  selectedRackCount,
  mode,
  onPlay,
  onExchange,
  onPass,
  onRecall,
  onToggleMode,
  onCheckWord,
  isSubmitting,
  tilesInBag,
  dictionaryMode,
}: ScrabbleActionsProps) {
  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-stone-500 animate-pulse" />
          Waiting for opponent&apos;s turn...
        </div>
        {dictionaryMode !== 'off' && onCheckWord && (
          <ActionButton onClick={onCheckWord} variant="muted">
            <Search className="h-3.5 w-3.5" />
            Check word
          </ActionButton>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3">
      {mode === 'play' ? (
        <>
          <div className="flex items-center gap-1.5">
            <ActionButton
              onClick={onRecall}
              disabled={!hasPendingTiles || isSubmitting}
              variant="secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recall
            </ActionButton>
            <ActionButton
              onClick={onToggleMode}
              disabled={hasPendingTiles || isSubmitting || tilesInBag < 7}
              variant="secondary"
              title={tilesInBag < 7 ? 'Not enough tiles in bag to exchange' : 'Switch to exchange mode'}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Swap
            </ActionButton>
            {dictionaryMode !== 'off' && onCheckWord && (
              <ActionButton onClick={onCheckWord} variant="muted">
                <Search className="h-3.5 w-3.5" />
              </ActionButton>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <ActionButton
              onClick={onPass}
              disabled={hasPendingTiles || isSubmitting}
              variant="muted"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pass
            </ActionButton>
            <ActionButton
              onClick={onPlay}
              disabled={!hasPendingTiles || isSubmitting}
              variant="primary"
            >
              <Play className="h-3.5 w-3.5" />
              {isSubmitting ? 'Playing...' : 'Play'}
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <ActionButton
            onClick={onToggleMode}
            disabled={isSubmitting}
            variant="secondary"
          >
            Cancel
          </ActionButton>
          <div className="text-xs text-stone-400">
            Select tiles to swap ({selectedRackCount})
          </div>
          <ActionButton
            onClick={onExchange}
            disabled={selectedRackCount === 0 || isSubmitting}
            variant="primary"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {isSubmitting ? 'Swapping...' : 'Swap'}
          </ActionButton>
        </>
      )}
    </div>
  );
}
