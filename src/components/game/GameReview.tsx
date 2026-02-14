'use client';

import { useState } from 'react';
import { Game, Move, Seat } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded, checkAssassinHit } from '@/lib/game/gameLogic';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TappableClueWord } from './TappableClueWord';
import Link from 'next/link';

interface GameReviewProps {
  game: Game;
  moves: Move[];
  mySeat: Seat;
  /** Array of display names indexed by seat, e.g. ["Alice", "Bob"] */
  seatNames: string[];
}

export function GameReview({ game, moves, mySeat, seatNames }: GameReviewProps) {
  const [showBoard, setShowBoard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const words = game.words;
  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const assassinHit = checkAssassinHit(game.board_state);
  const won = game.result === 'win';

  const totalGuesses = moves.filter(m => m.move_type === 'guess').length;
  const correctGuesses = moves.filter(m => m.move_type === 'guess' && m.guess_result === 'agent').length;
  const totalClues = moves.filter(m => m.move_type === 'clue').length;
  const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

  return (
    <div className={cn(
      'min-h-dvh flex flex-col pb-[env(safe-area-inset-bottom)]',
      won ? 'bg-gradient-to-b from-emerald-900 to-emerald-950' : 'bg-gradient-to-b from-red-900 to-stone-950'
    )}>
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-7xl mb-4">
          {won ? '🎉' : (assassinHit ? '💀' : '⏱️')}
        </div>

        <h1 className={cn(
          'text-4xl font-black uppercase tracking-tight mb-2',
          won ? 'text-emerald-300' : 'text-red-300'
        )}>
          {won ? 'Victory!' : 'Game Over'}
        </h1>

        <p className="text-white/70 text-lg mb-8">
          {won && 'You found all the agents!'}
          {assassinHit && 'An assassin was revealed'}
          {!won && !assassinHit && 'Ran out of time'}
        </p>

        <div className="grid grid-cols-3 gap-6 mb-8 text-center">
          <div>
            <p className="text-3xl font-black text-white">{agentsFound}<span className="text-white/50 text-lg">/{totalAgents}</span></p>
            <p className="text-xs text-white/50 uppercase tracking-wide">Agents</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{totalClues}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide">Clues</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{accuracy}<span className="text-white/50 text-lg">%</span></p>
            <p className="text-xs text-white/50 uppercase tracking-wide">Accuracy</p>
          </div>
        </div>

        <Link href="/dashboard" className="w-full max-w-xs mb-4">
          <Button className={cn(
            'w-full h-14 text-lg font-bold rounded-xl shadow-lg',
            won
              ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950'
              : 'bg-white hover:bg-stone-100 text-stone-900'
          )}>
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setShowBoard(!showBoard)}
          >
            {showBoard ? 'Hide Board' : 'View Board'}
          </Button>
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'View History'}
          </Button>
        </div>
      </div>

      {/* Board view */}
      {showBoard && (
        <div className="bg-black/30 px-4 py-6">
          <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3 text-center">Final Board</h3>
          <div className="grid grid-cols-5 gap-1 max-w-sm mx-auto">
            {game.words.map((word, index) => {
              const types = game.key_card.map((_, seat) => getCardTypeForPlayer(index, game.key_card, seat));
              const revealed = game.board_state.revealed[word];

              const isAgent = types.map(t => t === 'agent');
              const isAssassin = types.map(t => t === 'assassin');

              let bgColor = 'bg-amber-100';
              let textColor = 'text-stone-700';

              if (isAgent.every(Boolean)) {
                bgColor = 'bg-emerald-500';
                textColor = 'text-white';
              } else if (isAssassin.every(Boolean)) {
                bgColor = 'bg-stone-900';
                textColor = 'text-white';
              } else if (isAgent.some(Boolean) && isAssassin.some(Boolean)) {
                bgColor = 'bg-gradient-to-br from-emerald-500 to-stone-800';
                textColor = 'text-white';
              } else if (isAgent.some(Boolean)) {
                bgColor = 'bg-emerald-300';
                textColor = 'text-emerald-900';
              } else if (isAssassin.some(Boolean)) {
                bgColor = 'bg-stone-700';
                textColor = 'text-white';
              }

              return (
                <div
                  key={`${word}-${index}`}
                  className={cn(
                    'aspect-square rounded flex items-center justify-center p-0.5',
                    bgColor,
                    textColor,
                    revealed && 'ring-2 ring-white/50'
                  )}
                >
                  <span className="text-[8px] font-bold uppercase text-center leading-tight">{word}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 justify-center text-[10px] text-white/60">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm"/> Shared Agent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-300 rounded-sm"/> Agent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-stone-900 rounded-sm"/> Assassin</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gradient-to-br from-emerald-500 to-stone-800 rounded-sm"/> Agent/Assassin</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 ring-2 ring-white/50 rounded-sm"/> Revealed</span>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="bg-black/30 px-4 py-6 max-h-[50vh] overflow-y-auto">
          <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3 text-center">Move History</h3>
          <div className="space-y-1 max-w-sm mx-auto">
            {moves.map((move) => (
              <div
                key={move.id}
                className={cn(
                  'px-3 py-2 rounded text-sm',
                  move.move_type === 'clue' && 'bg-blue-500/20 text-blue-200',
                  move.move_type === 'guess' && 'bg-white/10 text-white/80',
                  move.move_type === 'end_turn' && 'bg-white/5 text-white/40'
                )}
              >
                {move.move_type === 'clue' && (
                  <div>
                    <div>
                      <TappableClueWord word={move.clue_word?.toUpperCase() || ''} className="font-bold" />
                      <span className="text-amber-400 ml-1">{move.clue_number}</span>
                    </div>
                    {move.intended_words && move.intended_words.length > 0 && (
                      <div className="text-xs text-white/50 mt-0.5">
                        → {move.intended_words.map(idx => words[idx]).join(', ')}
                      </div>
                    )}
                  </div>
                )}
                {move.move_type === 'guess' && (
                  <span className="flex items-center gap-2">
                    <span className={cn(
                      'font-medium',
                      move.guess_result === 'agent' && 'text-emerald-400',
                      move.guess_result === 'bystander' && 'text-amber-400',
                      move.guess_result === 'assassin' && 'text-red-400'
                    )}>
                      {move.guess_index !== null && move.guess_index !== undefined ? words[move.guess_index] : '?'}
                    </span>
                    <span className="text-xs">
                      {move.guess_result === 'agent' && '✓'}
                      {move.guess_result === 'bystander' && '○'}
                      {move.guess_result === 'assassin' && '☠'}
                    </span>
                  </span>
                )}
                {move.move_type === 'end_turn' && (
                  <span className="italic text-xs">Pass</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
