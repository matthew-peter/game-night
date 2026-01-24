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
  
  // Card styling based on state
  const getCardStyles = () => {
    if (isRevealed) {
      if (revealed.type === 'agent') {
        return {
          card: 'bg-gradient-to-br from-green-400 via-green-500 to-green-600 border-green-300',
          text: 'text-white',
          label: 'bg-green-700 text-white',
          icon: <User className="w-10 h-10 text-white" />,
          iconLabel: 'AGENT',
        };
      } else if (revealed.type === 'assassin') {
        return {
          card: 'bg-gradient-to-br from-stone-800 via-stone-900 to-black border-stone-600',
          text: 'text-white',
          label: 'bg-black text-white',
          icon: <Skull className="w-10 h-10 text-red-500" />,
          iconLabel: 'ASSASSIN',
        };
      } else {
        // Bystander
        return {
          card: 'bg-gradient-to-br from-amber-200 via-amber-300 to-orange-300 border-amber-400',
          text: 'text-amber-900',
          label: 'bg-amber-500 text-white',
          icon: <Eye className="w-10 h-10 text-amber-700" />,
          iconLabel: 'BYSTANDER',
        };
      }
    }
    
    // Unrevealed card - show VERY clear hints for clue giver
    if (cardTypeForMe === 'agent') {
      return {
        card: 'bg-gradient-to-br from-green-100 to-green-200 border-green-500 border-3',
        text: 'text-green-800',
        label: 'bg-green-500 text-white',
        icon: null,
        iconLabel: null,
      };
    } else if (cardTypeForMe === 'assassin') {
      return {
        card: 'bg-gradient-to-br from-stone-300 to-stone-400 border-stone-800 border-3',
        text: 'text-stone-900',
        label: 'bg-stone-800 text-white',
        icon: null,
        iconLabel: null,
      };
    } else {
      // Bystander for me
      return {
        card: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 border-2',
        text: 'text-amber-800',
        label: 'bg-white text-stone-700',
        icon: null,
        iconLabel: null,
      };
    }
  };
  
  const styles = getCardStyles();
  
  // Selection state for clue giving
  const selectionStyles = isSelected && !isRevealed 
    ? 'ring-4 ring-blue-500 ring-offset-2 scale-105' 
    : '';
  
  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowDefinition(true);
    }, 2000); // 2 second long press for dictionary
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
          'relative w-full aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden',
          'transition-all duration-150',
          'touch-manipulation select-none',
          styles.card,
          selectionStyles,
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
  
  const isMyTurn = game.current_turn === playerRole;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';
  
  // Clue giver: it's my turn and we're in clue phase
  const isGivingClue = isMyTurn && isCluePhase && game.status === 'playing';
  // Guesser: it's my turn and we're in guess phase
  const isGuessing = isMyTurn && isGuessPhase && game.status === 'playing';
  
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
            onToggleSelect={toggleWordForClue}
            onGuess={onGuess}
          />
        ))}
      </div>
    </div>
  );
}
