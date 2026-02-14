'use client';

import { useState, useCallback, useRef, memo, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { Game, Seat, CardType } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { cn } from '@/lib/utils';
import { WordDefinition } from './WordDefinition';
import { broadcastSelectingWords } from './PresenceIndicator';

interface WordCardProps {
  word: string;
  index: number;
  game: Game;
  mySeat: Seat;
  isGivingClue: boolean;
  isGuessing: boolean;
  isSelected: boolean;
  isHighlightedForGuess: boolean;
  flipAnimation: 'agent' | 'bystander' | 'assassin' | null;
  onToggleSelect: (word: string) => void;
  onHighlightForGuess: (wordIndex: number) => void;
  onConfirmGuess: (wordIndex: number) => void;
}

const WordCard = memo(function WordCard({
  word,
  index,
  game,
  mySeat,
  isGivingClue,
  isGuessing,
  isSelected,
  isHighlightedForGuess,
  flipAnimation,
  onToggleSelect,
  onHighlightForGuess,
  onConfirmGuess,
}: WordCardProps) {
  const [showDefinition, setShowDefinition] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const handledByTouch = useRef(false);

  const revealed = game.board_state.revealed[word];
  const isRevealed = !!revealed;

  // Get card type from MY perspective and the other seat's perspective
  const cardTypeForMe = getCardTypeForPlayer(index, game.key_card, mySeat);
  const otherSeat = mySeat === 0 ? 1 : 0; // For 2-player Codenames
  const cardTypeForThem = getCardTypeForPlayer(index, game.key_card, otherSeat);

  const alreadyFoundAsAgent = isRevealed && revealed.type === 'agent';
  const canStillBeGuessed = !alreadyFoundAsAgent;
  const isStillMyAgent = !alreadyFoundAsAgent && cardTypeForMe === 'agent';

  const getFontSize = () => {
    if (word.length <= 5) return 'text-[11px]';
    if (word.length <= 7) return 'text-[10px]';
    if (word.length <= 9) return 'text-[9px]';
    return 'text-[8px]';
  };

  const guessedByMe = revealed?.guessedBy === mySeat;

  const getCardStyles = () => {
    if (isRevealed) {
      if (revealed.type === 'agent') {
        return {
          card: 'bg-emerald-600 border-emerald-700',
          text: 'text-white',
          indicator: guessedByMe ? '✓ YOU' : '✓ THEM',
          indicatorColor: 'bg-emerald-800 text-emerald-100',
        };
      } else if (revealed.type === 'assassin') {
        return {
          card: 'bg-red-700 border-red-900',
          text: 'text-white',
          indicator: '☠ DEAD',
          indicatorColor: 'bg-red-900 text-white',
        };
      } else {
        const showGreenBorder = isStillMyAgent;
        return {
          card: showGreenBorder
            ? 'bg-amber-200 border-emerald-500 border-2'
            : 'bg-amber-200 border-amber-400',
          text: 'text-amber-900',
          indicator: guessedByMe ? '○ YOU' : '○ THEM',
          indicatorColor: showGreenBorder
            ? 'bg-emerald-600 text-white'
            : 'bg-amber-300 text-amber-800',
        };
      }
    }

    if (cardTypeForMe === 'agent') {
      return {
        card: 'bg-emerald-50 border-emerald-400 border-2',
        text: 'text-emerald-900',
      };
    } else if (cardTypeForMe === 'assassin') {
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

  const selectionStyles = isSelected && (!isRevealed || isStillMyAgent)
    ? 'ring-4 ring-blue-500 ring-offset-2 scale-105'
    : '';

  const canBeGuessed = canStillBeGuessed;
  const highlightStyles = isHighlightedForGuess && canBeGuessed
    ? 'ring-4 ring-amber-400 ring-offset-2 scale-105'
    : '';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isLongPress.current = false;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowDefinition(true);
    }, 1000);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 15 || dy > 15) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        touchStartPos.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (!touchStartPos.current) return;
    touchStartPos.current = null;

    if (isLongPress.current) return;

    handledByTouch.current = true;
    e.preventDefault();

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const canClue = !isRevealed || isStillMyAgent;

    if (isGivingClue && canClue) {
      onToggleSelect(word);
    } else if (isGuessing && canStillBeGuessed) {
      if (isHighlightedForGuess) {
        onConfirmGuess(index);
      } else {
        onHighlightForGuess(index);
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isStillMyAgent, canStillBeGuessed, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);

  const handleClick = useCallback(() => {
    if (handledByTouch.current) {
      handledByTouch.current = false;
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const canClue = !isRevealed || isStillMyAgent;

    if (isGivingClue && canClue) {
      onToggleSelect(word);
    } else if (isGuessing && canStillBeGuessed) {
      if (isHighlightedForGuess) {
        onConfirmGuess(index);
      } else {
        onHighlightForGuess(index);
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isStillMyAgent, canStillBeGuessed, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDefinition(true);
  }, []);

  const flipClass = flipAnimation === 'agent'
    ? 'animate-flip-agent'
    : flipAnimation === 'assassin'
    ? 'animate-flip-assassin'
    : flipAnimation === 'bystander'
    ? 'animate-flip-bystander'
    : '';

  return (
    <>
      <div className="card-flip-container w-full">
        <button
          className={cn(
            'relative w-full aspect-square rounded-lg flex flex-col items-center justify-center overflow-hidden',
            'transition-all duration-150',
            'touch-manipulation select-none',
            styles.card,
            selectionStyles,
            highlightStyles,
            flipClass,
            ((!isRevealed || isStillMyAgent) && isGivingClue || canBeGuessed && isGuessing) && 'active:scale-95 cursor-pointer',
          )}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          disabled={!canStillBeGuessed && !isStillMyAgent && !showDefinition}
        >
          <span className={cn(
            'font-bold uppercase text-center leading-tight px-0.5',
            getFontSize(),
            styles.text
          )}>
            {word}
          </span>

          {isRevealed && 'indicator' in styles && (
            <div className={cn(
              'absolute bottom-0 left-0 right-0 text-[7px] font-bold py-0.5 text-center',
              styles.indicatorColor
            )}>
              {styles.indicator}
            </div>
          )}

          {isSelected && !isRevealed && (
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">✓</span>
            </div>
          )}

          {isHighlightedForGuess && canBeGuessed && (
            <div className="absolute bottom-0 left-0 right-0 bg-amber-500 py-0.5 rounded-b-lg">
              <span className="text-[7px] font-bold text-amber-900 uppercase">
                Tap to guess
              </span>
            </div>
          )}
        </button>
      </div>

      {showDefinition && (
        <WordDefinition
          word={word}
          onClose={() => setShowDefinition(false)}
        />
      )}
    </>
  );
});

interface GameBoardProps {
  game: Game;
  mySeat: Seat;
  onGuess: (wordIndex: number) => void;
  hasActiveClue?: boolean;
}

export function GameBoard({ game, mySeat, onGuess, hasActiveClue = false }: GameBoardProps) {
  const { selectedWordsForClue, toggleWordForClue } = useGameStore();
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number | null>(null);
  const [flippingWords, setFlippingWords] = useState<Record<string, CardType>>({});
  const [boardShaking, setBoardShaking] = useState(false);
  const prevRevealedRef = useRef<Record<string, { type: CardType }>>(game.board_state.revealed);

  useEffect(() => {
    const prevRevealed = prevRevealedRef.current;
    const currentRevealed = game.board_state.revealed;

    const newlyRevealed: Record<string, CardType> = {};
    for (const word of Object.keys(currentRevealed)) {
      if (!prevRevealed[word]) {
        newlyRevealed[word] = currentRevealed[word].type;
      }
    }

    if (Object.keys(newlyRevealed).length > 0) {
      setFlippingWords(newlyRevealed);

      const hasAssassin = Object.values(newlyRevealed).includes('assassin');
      if (hasAssassin) {
        setBoardShaking(true);
      }

      const timeout = setTimeout(() => {
        setFlippingWords({});
        setBoardShaking(false);
      }, 1600);
      return () => clearTimeout(timeout);
    }

    prevRevealedRef.current = currentRevealed;
  }, [game.board_state.revealed]);

  useEffect(() => {
    prevRevealedRef.current = game.board_state.revealed;
  });

  const handleToggleWordForClue = useCallback((word: string) => {
    toggleWordForClue(word);
    broadcastSelectingWords();
  }, [toggleWordForClue]);

  const isClueGiver = game.current_turn === mySeat;
  const isGuesser = game.current_turn !== mySeat;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';

  const isGivingClue = isClueGiver && isCluePhase && game.status === 'playing';
  const isGuessing = isGuesser && isGuessPhase && game.status === 'playing';

  const handleHighlightForGuess = useCallback((wordIndex: number) => {
    setHighlightedWordIndex(prev => prev === wordIndex ? null : wordIndex);
  }, []);

  const handleConfirmGuess = useCallback((wordIndex: number) => {
    setHighlightedWordIndex(null);
    onGuess(wordIndex);
  }, [onGuess]);

  return (
    <div className="w-full max-w-md mx-auto px-1">
      <div className={cn("grid grid-cols-5 gap-1", boardShaking && "animate-board-shake")}>
        {game.words.map((word, index) => (
          <WordCard
            key={`${word}-${index}`}
            word={word}
            index={index}
            game={game}
            mySeat={mySeat}
            isGivingClue={isGivingClue}
            isGuessing={isGuessing}
            isSelected={selectedWordsForClue.has(word)}
            isHighlightedForGuess={highlightedWordIndex === index}
            flipAnimation={flippingWords[word] || null}
            onToggleSelect={handleToggleWordForClue}
            onHighlightForGuess={handleHighlightForGuess}
            onConfirmGuess={handleConfirmGuess}
          />
        ))}
      </div>
    </div>
  );
}
