'use client';

import { cn } from '@/lib/utils';
import { LastPlay, FormedWord } from '@/lib/game/scrabble/types';
import { ArrowLeftRight, SkipForward, RotateCcw, Search, Check, CheckCircle, XCircle, Loader2, ShieldAlert } from 'lucide-react';

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
  onChallenge?: () => void;
  onCheckWord?: () => void;
  onCheckFormedWords?: () => void;
  isSubmitting: boolean;
  tilesInBag: number;
  dictionaryMode: string;
  allFormedWords?: FormedWord[];
  pendingScore?: number;
  wordCheckResult?: 'valid' | 'invalid' | null;
  invalidWords?: string[];
  isCheckingWord?: boolean;
  lastPlay?: LastPlay;
  lastPlayPlayerName?: string;
}

const actionBtn = 'flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] font-medium rounded-lg sm:rounded-xl active:scale-95 transition-all';

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
  onChallenge,
  onCheckWord,
  onCheckFormedWords,
  isSubmitting,
  tilesInBag,
  dictionaryMode,
  allFormedWords = [],
  pendingScore = 0,
  wordCheckResult = null,
  invalidWords = [],
  isCheckingWord = false,
  lastPlay,
  lastPlayPlayerName,
}: ScrabbleActionsProps) {
  const canChallenge = !hasPendingTiles
    && dictionaryMode === 'friendly'
    && lastPlay?.type === 'place'
    && onChallenge;

  // ── Not my turn ───────────────────────────────────────────────────────
  if (!isMyTurn) {
    return (
      <div className="px-3 py-1.5 space-y-1">
        {canChallenge && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <span className="text-[0.7rem] text-amber-800">
              <span className="font-semibold">{lastPlayPlayerName ?? 'Opponent'}</span> played{' '}
              <span className="font-bold uppercase">{lastPlay.words?.map(w => w.word).join(', ')}</span>
            </span>
            <button
              onClick={onChallenge}
              disabled={isSubmitting}
              className={cn(actionBtn, 'text-white bg-amber-600 hover:bg-amber-500 shadow-sm disabled:opacity-40')}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {isSubmitting ? 'Checking...' : 'Challenge'}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-stone-300 animate-pulse" />
            Their turn...
          </div>
          {dictionaryMode !== 'off' && onCheckWord && (
            <button
              onClick={onCheckWord}
              className={cn(actionBtn, 'text-stone-500 bg-stone-100 hover:bg-stone-200')}
            >
              <Search className="w-3.5 h-3.5" />
              Look up
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Exchange mode ─────────────────────────────────────────────────────
  if (mode === 'exchange') {
    return (
      <div className="px-3 py-2 space-y-1.5">
        <div className="text-xs text-center text-stone-500 font-medium">
          Tap tiles to select, then swap
        </div>
        <div className="flex items-center justify-between gap-3">
          <button onClick={onToggleMode} disabled={isSubmitting} className={cn(actionBtn, 'text-stone-600 bg-stone-100 hover:bg-stone-200 shadow-sm')}>Cancel</button>
          <span className="text-xs text-stone-500 tabular-nums font-medium">{selectedRackCount} selected</span>
          <button
            onClick={onExchange}
            disabled={selectedRackCount === 0 || isSubmitting}
            className={cn(actionBtn, 'text-white bg-[#8B1A1A] hover:bg-[#A02020] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed')}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {isSubmitting ? 'Swapping...' : 'Swap'}
          </button>
        </div>
      </div>
    );
  }

  // ── Play mode ─────────────────────────────────────────────────────────
  const hasWords = hasPendingTiles && allFormedWords.length > 0;

  return (
    <div className="px-3 py-1.5 space-y-1">
      {/* Challenge banner */}
      {canChallenge && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <span className="text-[0.7rem] text-amber-800">
            <span className="font-semibold">{lastPlayPlayerName ?? 'Opponent'}</span> played{' '}
            <span className="font-bold uppercase">{lastPlay.words?.map(w => w.word).join(', ')}</span>
          </span>
          <button
            onClick={onChallenge}
            disabled={isSubmitting}
            className={cn(actionBtn, 'text-white bg-amber-600 hover:bg-amber-500 shadow-sm disabled:opacity-40')}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {isSubmitting ? 'Checking...' : 'Challenge'}
          </button>
        </div>
      )}

      {/* Formed words + score + check */}
      {hasPendingTiles && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {hasWords && (
            <span className="text-sm font-bold uppercase tracking-wider text-stone-700">
              {allFormedWords.map(w => w.word).join(' · ')}
            </span>
          )}
          {pendingScore > 0 && (
            <span className="text-sm font-bold tabular-nums text-emerald-700">
              +{pendingScore}
            </span>
          )}
          {hasWords && dictionaryMode !== 'off' && (
            <>
              {wordCheckResult === 'valid' ? (
                <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" /> all valid</span>
              ) : wordCheckResult === 'invalid' ? (
                <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5" /> {invalidWords.join(', ')}
                </span>
              ) : isCheckingWord ? (
                <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" />
              ) : (
                <button onClick={onCheckFormedWords} className="text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors">Check?</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Hint */}
      {!hasPendingTiles && !hasSelectedRackTile && !canChallenge && (
        <div className="text-xs text-stone-400 text-center">Tap a tile, then tap the board</div>
      )}
      {hasSelectedRackTile && !hasPendingTiles && (
        <div className="text-xs text-stone-500 text-center font-medium">Now tap a cell on the board</div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {hasPendingTiles && (
            <button onClick={onRecall} disabled={isSubmitting} className={cn(actionBtn, 'text-stone-600 bg-stone-100 hover:bg-stone-200 shadow-sm disabled:opacity-40')}>
              <RotateCcw className="w-3.5 h-3.5" />
              Recall
            </button>
          )}
          {!hasPendingTiles && (
            <>
              <button
                onClick={onToggleMode}
                disabled={isSubmitting || tilesInBag < 7}
                className={cn(actionBtn, 'text-stone-600 bg-stone-100 hover:bg-stone-200 shadow-sm disabled:opacity-30')}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Swap
              </button>
              <button onClick={onPass} disabled={isSubmitting} className={cn(actionBtn, 'text-stone-600 bg-stone-100 hover:bg-stone-200 shadow-sm disabled:opacity-40')}>
                <SkipForward className="w-3.5 h-3.5" />
                Pass
              </button>
            </>
          )}
          {dictionaryMode !== 'off' && onCheckWord && (
            <button onClick={onCheckWord} className={cn(actionBtn, 'text-stone-400 bg-stone-100 hover:bg-stone-200 shadow-sm')}>
              <Search className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Play button */}
        <button
          onClick={onPlay}
          disabled={!hasPendingTiles || isSubmitting}
          className={cn(
            'flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-lg sm:rounded-xl transition-all active:scale-95',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            hasPendingTiles
              ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-md shadow-emerald-600/25'
              : 'bg-stone-200 text-stone-400',
          )}
        >
          <Check className="w-4 h-4" />
          {isSubmitting ? 'Playing...' : 'Play'}
        </button>
      </div>
    </div>
  );
}
