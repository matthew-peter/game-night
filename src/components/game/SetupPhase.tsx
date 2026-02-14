'use client';

import { useState, useCallback, memo } from 'react';
import { Game, CurrentTurn, SetupState } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WordDefinition } from './WordDefinition';
import { Shuffle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SetupWordCardProps {
  word: string;
  index: number;
  game: Game;
  playerRole: CurrentTurn;
  canSwap: boolean;
  isSwapping: boolean;
  onSwap: (index: number) => void;
  onLookup: (word: string) => void;
}

const SetupWordCard = memo(function SetupWordCard({
  word,
  index,
  game,
  playerRole,
  canSwap,
  isSwapping,
  onSwap,
  onLookup,
}: SetupWordCardProps) {
  const cardType = getCardTypeForPlayer(index, game.key_card, playerRole);

  // Dynamic font size based on word length
  const getFontSize = () => {
    if (word.length <= 5) return 'text-[11px]';
    if (word.length <= 7) return 'text-[10px]';
    if (word.length <= 9) return 'text-[9px]';
    return 'text-[8px]';
  };

  const getCardStyles = () => {
    if (cardType === 'agent') {
      return {
        card: 'bg-emerald-50 border-emerald-400 border-2',
        text: 'text-emerald-900',
      };
    } else if (cardType === 'assassin') {
      return {
        card: 'bg-stone-700 border-stone-900 border-2',
        text: 'text-stone-100',
      };
    } else {
      return {
        card: 'bg-amber-50 border-amber-200 border',
        text: 'text-stone-700',
      };
    }
  };

  const styles = getCardStyles();

  return (
    <div className="relative w-full">
      <button
        className={cn(
          'w-full aspect-square rounded-lg flex flex-col items-center justify-center overflow-hidden',
          'touch-manipulation select-none transition-all duration-150',
          styles.card,
          isSwapping && 'opacity-50 scale-95'
        )}
        onClick={() => onLookup(word)}
      >
        <span
          className={cn(
            'font-bold uppercase text-center leading-tight px-0.5',
            getFontSize(),
            styles.text
          )}
        >
          {isSwapping ? '...' : word}
        </span>
      </button>

      {/* Swap button overlay */}
      {canSwap && !isSwapping && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSwap(index);
          }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
          aria-label={`Swap ${word}`}
        >
          <Shuffle className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
});

interface SetupPhaseProps {
  game: Game;
  playerRole: CurrentTurn;
  opponentName?: string;
  onGameUpdated: () => void;
}

export function SetupPhase({
  game,
  playerRole,
  opponentName = 'Partner',
  onGameUpdated,
}: SetupPhaseProps) {
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [markingReady, setMarkingReady] = useState(false);
  const [lookupWord, setLookupWord] = useState<string | null>(null);

  const setup = game.board_state.setup as SetupState;

  const mySwapsUsed =
    playerRole === 'player1'
      ? setup.player1SwapsUsed
      : setup.player2SwapsUsed;
  const myReady =
    playerRole === 'player1' ? setup.player1Ready : setup.player2Ready;
  const partnerReady =
    playerRole === 'player1' ? setup.player2Ready : setup.player1Ready;
  const swapsRemaining = setup.maxSwaps - mySwapsUsed;

  const canSwap = !myReady && swapsRemaining > 0;

  const handleSwap = useCallback(
    async (wordIndex: number) => {
      if (swappingIndex !== null) return; // Prevent double-tap
      setSwappingIndex(wordIndex);

      try {
        const res = await fetch(`/api/games/${game.id}/swap-word`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordIndex }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || 'Failed to swap word');
        } else {
          const data = await res.json();
          toast.success(`Swapped "${data.oldWord}" → "${data.newWord}"`);
          onGameUpdated();
        }
      } catch {
        toast.error('Network error — please try again');
      } finally {
        setSwappingIndex(null);
      }
    },
    [game.id, swappingIndex, onGameUpdated]
  );

  const handleReady = useCallback(async () => {
    setMarkingReady(true);

    try {
      const res = await fetch(`/api/games/${game.id}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to mark as ready');
      } else {
        onGameUpdated();
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setMarkingReady(false);
    }
  }, [game.id, onGameUpdated]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col overflow-hidden z-40">
      {/* Header */}
      <div className="bg-stone-700 px-3 py-3 border-b border-stone-600">
        <div className="max-w-md mx-auto">
          <h2 className="text-white font-bold text-center text-sm">
            Review the Board
          </h2>
          <p className="text-stone-300 text-center text-xs mt-1">
            Tap the <Shuffle className="inline w-3 h-3 text-blue-400" /> on any
            word you don&apos;t know to swap it out
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-stone-800/80 px-3 py-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-300">
              Swaps remaining:{' '}
              <span className="font-bold text-blue-400">{swapsRemaining}</span>
              <span className="text-stone-500">/{setup.maxSwaps}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {partnerReady ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                {opponentName} ready
              </span>
            ) : (
              <span className="text-xs text-stone-400">
                Waiting for {opponentName}...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      <main className="flex-1 overflow-y-auto py-3 px-1 game-scroll-area">
        <div className="w-full max-w-md mx-auto px-1">
          <div className="grid grid-cols-5 gap-1">
            {game.words.map((word, index) => (
              <SetupWordCard
                key={`${word}-${index}`}
                word={word}
                index={index}
                game={game}
                playerRole={playerRole}
                canSwap={canSwap}
                isSwapping={swappingIndex === index}
                onSwap={handleSwap}
                onLookup={setLookupWord}
              />
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div className="max-w-md mx-auto mt-4 px-3">
          <div className="bg-stone-800/60 rounded-lg p-3 text-xs text-stone-400 space-y-1">
            <p>
              <span className="inline-block w-3 h-3 bg-emerald-50 border-2 border-emerald-400 rounded-sm align-middle mr-1" />{' '}
              Your agents (your partner will try to guess these)
            </p>
            <p>
              <span className="inline-block w-3 h-3 bg-stone-700 border-2 border-stone-900 rounded-sm align-middle mr-1" />{' '}
              Assassins (avoid!)
            </p>
            <p>
              <span className="inline-block w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm align-middle mr-1" />{' '}
              Bystanders
            </p>
            <p className="mt-2 text-stone-500">
              Long-press any word to look up its definition.
            </p>
          </div>
        </div>
      </main>

      {/* Ready button */}
      <div className="bg-stone-800 border-t border-stone-600 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {myReady ? (
            <div className="text-center text-emerald-400 font-medium text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              You&apos;re ready! Waiting for {opponentName}...
            </div>
          ) : (
            <Button
              onClick={handleReady}
              disabled={markingReady}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-base rounded-xl"
            >
              {markingReady ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              I&apos;m Ready to Play
            </Button>
          )}
        </div>
      </div>

      {/* Definition modal */}
      {lookupWord && (
        <WordDefinition
          word={lookupWord}
          onClose={() => setLookupWord(null)}
        />
      )}
    </div>
  );
}
