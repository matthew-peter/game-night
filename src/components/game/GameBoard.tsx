'use client';

import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { Game, CurrentTurn, CardType } from '@/lib/supabase/types';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { isWordRevealed } from '@/lib/game/gameLogic';
import { cn } from '@/lib/utils';
import { WordDefinition } from './WordDefinition';
import { User, Eye, Skull } from 'lucide-react';

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
  
  // Get card type from current player's key (what they see)
  const cardTypeForMe = getCardTypeForPlayer(index, game.key_card, playerRole);
  
  // Card styling based on state - matches real Codenames Duet colors
  const getCardStyles = () => {
    if (isRevealed) {
      if (revealed.type === 'agent') {
        // Forest green - found agent
        return {
          card: 'bg-emerald-700 border-emerald-900',
          text: 'text-white',
        };
      } else if (revealed.type === 'assassin') {
        // Black - assassin
        return {
          card: 'bg-stone-900 border-stone-950',
          text: 'text-white',
        };
      } else {
        // Tan/beige - bystander
        return {
          card: 'bg-amber-100 border-amber-300',
          text: 'text-amber-900',
        };
      }
    }
    
    // Unrevealed cards - show hints for clue giver
    if (cardTypeForMe === 'agent') {
      // Light green tint for your agents
      return {
        card: 'bg-emerald-100 border-emerald-400 border-2',
        text: 'text-emerald-900',
      };
    } else if (cardTypeForMe === 'assassin') {
      // Dark gray for assassins
      return {
        card: 'bg-stone-300 border-stone-600 border-2',
        text: 'text-stone-900',
      };
    } else {
      // Cream/beige for bystanders
      return {
        card: 'bg-amber-50 border-amber-200',
        text: 'text-stone-700',
      };
    }
  };
  
  const styles = getCardStyles();
  
  // Selection state for clue giving
  const selectionStyles = isSelected && !isRevealed 
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
    
    if (!isLongPress.current && !isRevealed) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing) {
        if (isHighlightedForGuess) {
          onConfirmGuess(index);
        } else {
          onHighlightForGuess(index);
        }
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);
  
  const handleClick = useCallback(() => {
    if (!isRevealed) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing) {
        if (isHighlightedForGuess) {
          onConfirmGuess(index);
        } else {
          onHighlightForGuess(index);
        }
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, isHighlightedForGuess, word, index, onToggleSelect, onHighlightForGuess, onConfirmGuess]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDefinition(true);
  }, []);

  return (
    <>
      <button
        className={cn(
          'relative w-full aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden',
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
        {/* Word - always visible */}
        <span className={cn(
          'text-[11px] font-bold uppercase text-center leading-tight px-0.5',
          styles.text
        )}>
          {word}
        </span>
        
        {/* Revealed overlay icon */}
        {isRevealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            {revealed.type === 'agent' && <User className="w-6 h-6 text-white drop-shadow" />}
            {revealed.type === 'assassin' && <Skull className="w-6 h-6 text-white drop-shadow" />}
            {revealed.type === 'bystander' && <Eye className="w-6 h-6 text-amber-800 drop-shadow" />}
          </div>
        )}
        
        {/* Selection checkmark */}
        {isSelected && !isRevealed && (
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">✓</span>
          </div>
        )}
        
        {/* Highlight for guess - tap again prompt */}
        {isHighlightedForGuess && !isRevealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-500/30">
            <span className="text-[9px] font-bold text-amber-900 bg-white/80 px-1.5 py-0.5 rounded">
              TAP TO CONFIRM
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
