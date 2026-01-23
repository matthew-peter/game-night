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
  onToggleSelect: (word: string) => void;
  onGuess: (wordIndex: number) => void;
}

function WordCard({
  word,
  index,
  game,
  playerRole,
  isGivingClue,
  isGuessing,
  isSelected,
  onToggleSelect,
  onGuess,
}: WordCardProps) {
  const [showDefinition, setShowDefinition] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  
  const revealed = game.board_state.revealed[word];
  const isRevealed = !!revealed;
  
  // Get card type from current player's key (what they see)
  const cardTypeForMe = getCardTypeForPlayer(index, game.key_card, playerRole);
  
  // Determine card display state
  let bgColor = 'bg-stone-100'; // Default unrevealed
  let borderColor = 'border-stone-300';
  let textColor = 'text-stone-800';
  
  if (isRevealed) {
    // Card has been revealed
    if (revealed.type === 'agent') {
      bgColor = 'bg-green-500';
      borderColor = 'border-green-600';
      textColor = 'text-white';
    } else if (revealed.type === 'assassin') {
      bgColor = 'bg-stone-900';
      borderColor = 'border-stone-950';
      textColor = 'text-white';
    } else {
      // Bystander
      bgColor = 'bg-amber-200';
      borderColor = 'border-amber-400';
      textColor = 'text-amber-900';
    }
  } else {
    // Show key card colors for unrevealed cards (clue giver's perspective)
    if (cardTypeForMe === 'agent') {
      borderColor = 'border-green-500 border-2';
    } else if (cardTypeForMe === 'assassin') {
      borderColor = 'border-stone-900 border-2';
    }
  }
  
  // Selection state for clue giving
  if (isSelected && !isRevealed) {
    borderColor = 'border-blue-500 border-3 ring-2 ring-blue-300';
    bgColor = 'bg-blue-50';
  }
  
  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowDefinition(true);
    }, 500);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (!isLongPress.current && !isRevealed) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing) {
        onGuess(index);
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, word, index, onToggleSelect, onGuess]);
  
  const handleClick = useCallback(() => {
    if (!isRevealed) {
      if (isGivingClue) {
        onToggleSelect(word);
      } else if (isGuessing) {
        onGuess(index);
      }
    }
  }, [isGivingClue, isGuessing, isRevealed, word, index, onToggleSelect, onGuess]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDefinition(true);
  }, []);

  return (
    <>
      <button
        className={cn(
          'relative w-full aspect-[4/3] rounded-lg border-2 flex items-center justify-center p-1 transition-all',
          'text-xs sm:text-sm font-semibold uppercase tracking-tight',
          'touch-manipulation select-none',
          bgColor,
          borderColor,
          textColor,
          !isRevealed && (isGivingClue || isGuessing) && 'active:scale-95 cursor-pointer',
          isRevealed && 'opacity-80'
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        disabled={isRevealed}
      >
        <span className="text-center leading-tight break-words hyphens-auto">
          {word}
        </span>
        
        {/* Reveal indicator */}
        {isRevealed && (
          <div className="absolute top-1 right-1">
            {revealed.type === 'agent' && <span className="text-xs">✓</span>}
            {revealed.type === 'assassin' && <span className="text-xs">☠</span>}
            {revealed.type === 'bystander' && <span className="text-xs">○</span>}
          </div>
        )}
        
        {/* Who guessed indicator */}
        {isRevealed && (
          <div className="absolute bottom-1 left-1 text-[10px] opacity-70">
            {revealed.guessedBy === 'player1' ? 'P1' : 'P2'}
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
}

export function GameBoard({ game, playerRole, onGuess }: GameBoardProps) {
  const { selectedWordsForClue, toggleWordForClue } = useGameStore();
  
  const isMyTurn = game.current_turn === playerRole;
  const hasActiveClue = !!game.current_clue;
  const isGivingClue = isMyTurn && !hasActiveClue && game.status === 'playing';
  const isGuessing = isMyTurn && hasActiveClue && game.status === 'playing';
  
  return (
    <div className="w-full max-w-lg mx-auto p-2">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
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
            onToggleSelect={toggleWordForClue}
            onGuess={onGuess}
          />
        ))}
      </div>
    </div>
  );
}
