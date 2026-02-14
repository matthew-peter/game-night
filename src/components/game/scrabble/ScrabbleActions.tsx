'use client';

import { Button } from '@/components/ui/button';
import { Play, ArrowLeftRight, SkipForward, RotateCcw } from 'lucide-react';

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
  isSubmitting: boolean;
  tilesInBag: number;
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
  isSubmitting,
  tilesInBag,
}: ScrabbleActionsProps) {
  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center py-3 px-4 text-stone-400">
        Waiting for opponent&apos;s turn...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3">
      {mode === 'play' ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRecall}
              disabled={!hasPendingTiles || isSubmitting}
              className="text-stone-300 border-stone-600"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Recall
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleMode}
              disabled={hasPendingTiles || isSubmitting || tilesInBag < 7}
              className="text-stone-300 border-stone-600"
              title={tilesInBag < 7 ? 'Not enough tiles in bag to exchange' : 'Switch to exchange mode'}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Exchange
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPass}
              disabled={hasPendingTiles || isSubmitting}
              className="text-stone-400 border-stone-600"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Pass
            </Button>
            <Button
              size="sm"
              onClick={onPlay}
              disabled={!hasPendingTiles || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="h-4 w-4 mr-1" />
              {isSubmitting ? 'Playing...' : 'Play'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleMode}
            disabled={isSubmitting}
            className="text-stone-300 border-stone-600"
          >
            Cancel
          </Button>
          <div className="text-xs text-stone-400">
            Select tiles to exchange ({selectedRackCount} selected)
          </div>
          <Button
            size="sm"
            onClick={onExchange}
            disabled={selectedRackCount === 0 || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            {isSubmitting ? 'Exchanging...' : 'Exchange'}
          </Button>
        </>
      )}
    </div>
  );
}
