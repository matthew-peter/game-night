'use client';

import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { Game, CurrentTurn, CardType } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { isWordRevealed } from '@/lib/game/gameLogic';
import { cn } from '@/lib/utils';
import { WordDefinition } from './WordDefinition';

interface WordCardProps {
  word: string;
  index: number;
  game: Game;
  playerRole: CurrentTurn;
  isGivingClue: boolean;
  isGuessing: boolean;
  isSelected: boolean;
  isHighlightedForGuess: boolean;
  onToggleSelect: (word: string) => void;
  onHighlightForGuess: (wordIndex: number) => void;
  onConfirmGuess: (wordIndex: number) => void;
}

function WordCard({
  word,
  index,
  game,
  playerRole,
  isGivingClue,
  isGuessing,
  isSelected,
  isHighlightedForGuess,
  onToggleSelect,
  onHighlightForGuess,
  onConfirmGuess,
}: WordCardProps) {
  const [showDefinition, setShowDefinition] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  
  const revealed = game.board_state.revealed[word];
  const isRevealed = !!revealed;
  
  // Get card type from BOTH player perspectives
  const cardTypeForMe = getCardTypeForPlayer(index, game.key_card, playerRole);
  const otherPlayer = playerRole === 'player1' ? 'player2' : 'player1';
  const cardTypeForThem = getCardTypeForPlayer(index, game.key_card, otherPlayer);
  
  // Dynamic font size based on word length
  const getFontSize = () => {
    if (word.length <= 5) return 'text-[11px]';
    if (word.length <= 7) return 'text-[10px]';
    if (word.length <= 9) return 'text-[9px]';
    return 'text-[8px]';
  };
  
  // Who guessed this card?
  const guessedByMe = revealed?.guessedBy === playerRole;
  const guessedByThem = revealed?.guessedBy && revealed?.guessedBy !== playerRole;
  
  // Key insight: A revealed card might be a bystander for whoever guessed it,
  // but could still be an agent on MY key that my partner needs to find
  const isStillMyAgent = isRevealed && revealed.type !== 'agent' && cardTypeForMe === 'agent';
  
  // Card styling based on state
  const getCardStyles = () => {
    if (isRevealed) {
      if (revealed.type === 'agent') {
        // Found agent - solid green
        return {
          card: 'bg-emerald-600 border-emerald-700',
          text: 'text-white',
          indicator: guessedByMe ? '✓ YOU' : '✓ THEM',
          indicatorColor: 'bg-emerald-800 text-emerald-100',
        };
      } else if (revealed.type === 'assassin') {
        // RED for assassin
        return {
          card: 'bg-red-700 border-red-900',
          text: 'text-white',
          indicator: '☠ DEAD',
          indicatorColor: 'bg-red-900 text-white',
        };
      } else {
        // Bystander - show who guessed it, but add green border if it's still MY agent
        return {
          card: isStillMyAgent 
            ? 'bg-amber-200 border-emerald-500 border-2' // amber bg + green border = bystander that's still your agent
            : 'bg-amber-200 border-amber-400',
          text: 'text-amber-900',
          indicator: guessedByMe ? '○ YOU' : '○ THEM',
          indicatorColor: isStillMyAgent 
            ? 'bg-emerald-600 text-white' // green indicator to emphasize it's still an agent
            : 'bg-amber-300 text-amber-800',
        };
      }
    }
    
    // Unrevealed cards - show hints for clue giver
    if (cardTypeForMe === 'agent') {
      return {
        card: 'bg-emerald-50 border-emerald-400 border-2',
        text: 'text-emerald-900',
      };
    } else if (cardTypeForMe === 'assassin') {
      // Show assassins clearly to clue giver
      return {
        card: 'bg-stone-700 border-stone-900 border-2',
        text: 'text-stone-100',
      };
    } else {
      // Cream for bystanders
      return {
        card: 'bg-amber-50 border-amber-200 border',
        text: 'text-stone-700',
      };
    }
  };
  
  const styles = getCardStyles();
  
  // Selection state for clue giving - allow for unrevealed OR isStillMyAgent
  const selectionStyles = isSelected && (!isRevealed || isStillMyAgent)
    ? 'ring-4 ring-blue-500 ring-offset-2 scale-105' 
    : '';
  
  // Highlight state for guessing (first tap)
  const highlightStyles = isHighlightedForGuess && !isRevealed
    ? 'ring-4 ring-amber-400 ring-offset-2 scale-105'
    : '';
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent click from also firing
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowDefinition(true);
    }, 2000); // 2 second long press for dictionary
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent click from also firing
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    // Allow interaction if: not revealed, OR revealed but still my agent to clue
    const canInteract = !isRevealed || (isStillMyAgent && isGivingClue);
    
    if (!isLongPress.current && canInteract) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing && !isRevealed) {
        if (isHighlightedForGuess) {
          onConfirmGuess(index);
        } else {
          onHighlightForGuess(index);
        }
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isStillMyAgent, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);
  
  const handleClick = useCallback(() => {
    // Allow interaction if: not revealed, OR revealed but still my agent to clue
    const canInteract = !isRevealed || (isStillMyAgent && isGivingClue);
    
    if (canInteract) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing && !isRevealed) {
        if (isHighlightedForGuess) {
          onConfirmGuess(index);
        } else {
          onHighlightForGuess(index);
        }
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isStillMyAgent, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDefinition(true);
  }, []);

  return (
    <>
      <button
        className={cn(
          'relative w-full aspect-square rounded-lg flex flex-col items-center justify-center overflow-hidden',
          'transition-all duration-150',
          'touch-manipulation select-none',
          styles.card,
          selectionStyles,
          highlightStyles,
          !isRevealed && (isGivingClue || isGuessing) && 'active:scale-95 cursor-pointer',
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        disabled={isRevealed && !showDefinition}
      >
        {/* Word - dynamic sizing */}
        <span className={cn(
          'font-bold uppercase text-center leading-tight px-0.5',
          getFontSize(),
          styles.text
        )}>
          {word}
        </span>
        
        {/* Who guessed indicator for revealed cards */}
        {isRevealed && 'indicator' in styles && (
          <div className={cn(
            'absolute bottom-0 left-0 right-0 text-[7px] font-bold py-0.5 text-center',
            styles.indicatorColor
          )}>
            {styles.indicator}
          </div>
        )}
        
        {/* Selection checkmark for clue giving */}
        {isSelected && !isRevealed && (
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">✓</span>
          </div>
        )}
        
        {/* Highlight for guess - tap again prompt */}
        {isHighlightedForGuess && !isRevealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-500/40 rounded-lg">
            <span className="text-[8px] font-bold text-amber-900 bg-white/90 px-1 py-0.5 rounded shadow">
              TAP AGAIN
            </span>
          </div>
        )}
      </button>
      
      {showDefinition && (
        <WordDefinition
          word={word}
          onClose={() => setShowDefinition(false)}
        />
      )}
    </>
  );
}

interface GameBoardProps {
  game: Game;
  playerRole: CurrentTurn;
  onGuess: (wordIndex: number) => void;
  hasActiveClue?: boolean;
}

export function GameBoard({ game, playerRole, onGuess, hasActiveClue = false }: GameBoardProps) {
  const { selectedWordsForClue, toggleWordForClue } = useGameStore();
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number | null>(null);
  
  const isClueGiver = game.current_turn === playerRole;
  const isGuesser = game.current_turn !== playerRole;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';
  
  // Clue giver: I'm the clue giver and we're in clue phase
  const isGivingClue = isClueGiver && isCluePhase && game.status === 'playing';
  // Guesser: I'm NOT the clue giver and we're in guess phase
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
      <div className="grid grid-cols-5 gap-1">
        {game.words.map((word, index) => (
          <WordCard
            key={`${word}-${index}`}
            word={word}
            index={index}
            game={game}
            playerRole={playerRole}
            isGivingClue={isGivingClue}
            isGuessing={isGuessing}
            isSelected={selectedWordsForClue.has(word)}
            isHighlightedForGuess={highlightedWordIndex === index}
            onToggleSelect={toggleWordForClue}
            onHighlightForGuess={handleHighlightForGuess}
            onConfirmGuess={handleConfirmGuess}
          />
        ))}
      </div>
    </div>
  );
}
