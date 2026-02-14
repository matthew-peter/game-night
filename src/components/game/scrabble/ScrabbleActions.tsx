'use client';

import { cn } from '@/lib/utils';
import { ArrowLeftRight, SkipForward, RotateCcw, Search, Check, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ScrabbleActionsProps {
  isMyTurn: boolean;
  hasPendingTiles: boolean;
  selectedRackCount: number;
  hasSelectedRackTile: boolean;
  mode: 'play' | 'exchange';
  onPlay: () => void;
  onExchange: () => void;
  onPass: () => void;
  onRecall: () => void;
  onToggleMode: () => void;
  onCheckWord?: () => void;
  onCheckFormedWord?: () => void;
  isSubmitting: boolean;
  tilesInBag: number;
  dictionaryMode: string;
  formedWord?: string;
  wordCheckResult?: 'valid' | 'invalid' | null;
  isCheckingWord?: boolean;
}

export function ScrabbleActions({
  isMyTurn,
  hasPendingTiles,
  selectedRackCount,
  hasSelectedRackTile,
  mode,
  onPlay,
  onExchange,
  onPass,
  onRecall,
  onToggleMode,
  onCheckWord,
  onCheckFormedWord,
  isSubmitting,
  tilesInBag,
  dictionaryMode,
  formedWord = '',
  wordCheckResult = null,
  isCheckingWord = false,
}: ScrabbleActionsProps) {
  // ── Not my turn ───────────────────────────────────────────────────────
  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-between py-2 px-4">
        <div className="flex items-center gap-2 text-stone-400 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />
          Their turn...
        </div>
        {dictionaryMode !== 'off' && onCheckWord && (
          <button
            onClick={onCheckWord}
            className="flex items-center gap-1 text-stone-500 text-xs px-2 py-1 rounded hover:bg-stone-100 transition-colors"
          >
            <Search className="w-3 h-3" />
            Look up
          </button>
        )}
      </div>
    );
  }

  // ── Exchange mode ─────────────────────────────────────────────────────
  if (mode === 'exchange') {
    return (
      <div className="px-3 py-2 space-y-1.5">
        <div className="text-xs text-center text-stone-500">
          Tap tiles to select, then swap
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onToggleMode}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded-lg border border-stone-200 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <span className="text-xs text-stone-500 tabular-nums">{selectedRackCount} selected</span>
          <button
            onClick={onExchange}
            disabled={selectedRackCount === 0 || isSubmitting}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#8B1A1A] hover:bg-[#A02020] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <span className="flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3" />
              {isSubmitting ? 'Swapping...' : 'Swap'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Play mode ─────────────────────────────────────────────────────────
  const showFormedWord = hasPendingTiles && formedWord.length >= 2;

  return (
    <div className="px-3 py-1.5 space-y-1">
      {/* Formed word + check */}
      {showFormedWord && dictionaryMode !== 'off' && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
            {formedWord}
          </span>
          {wordCheckResult === 'valid' ? (
            <span className="flex items-center gap-0.5 text-emerald-600 text-[11px]">
              <CheckCircle className="w-3 h-3" /> valid
            </span>
          ) : wordCheckResult === 'invalid' ? (
            <span className="flex items-center gap-0.5 text-red-600 text-[11px]">
              <XCircle className="w-3 h-3" /> not found
            </span>
          ) : isCheckingWord ? (
            <Loader2 className="w-3 h-3 text-stone-400 animate-spin" />
          ) : (
            <button
              onClick={onCheckFormedWord}
              className="text-[11px] text-blue-600 hover:text-blue-500 transition-colors"
            >
              Check?
            </button>
          )}
        </div>
      )}

      {/* Hint */}
      {!hasPendingTiles && !hasSelectedRackTile && (
        <div className="text-[11px] text-stone-400 text-center">Tap a tile, then tap the board</div>
      )}
      {hasSelectedRackTile && !hasPendingTiles && (
        <div className="text-[11px] text-stone-500 text-center">Now tap a cell on the board</div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {hasPendingTiles && (
            <button
              onClick={onRecall}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-500 rounded-lg hover:bg-stone-100 active:scale-95 transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              Recall
            </button>
          )}
          {!hasPendingTiles && (
            <>
              <button
                onClick={onToggleMode}
                disabled={isSubmitting || tilesInBag < 7}
                title={tilesInBag < 7 ? 'Not enough tiles to swap' : 'Swap tiles'}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-500 rounded-lg hover:bg-stone-100 active:scale-95 transition-all disabled:opacity-30"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Swap
              </button>
              <button
                onClick={onPass}
                disabled={isSubmitting}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-500 rounded-lg hover:bg-stone-100 active:scale-95 transition-all disabled:opacity-40"
              >
                <SkipForward className="w-3 h-3" />
                Pass
              </button>
            </>
          )}
          {dictionaryMode !== 'off' && onCheckWord && (
            <button
              onClick={onCheckWord}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-400 rounded-lg hover:bg-stone-100 active:scale-95 transition-all"
            >
              <Search className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Play button */}
        <button
          onClick={onPlay}
          disabled={!hasPendingTiles || isSubmitting}
          className={cn(
            'flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            hasPendingTiles
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              : 'bg-stone-200 text-stone-400 border border-stone-300',
          )}
        >
          <Check className="w-3.5 h-3.5" />
          {isSubmitting ? 'Playing...' : 'Play'}
        </button>
      </div>
    </div>
  );
}
