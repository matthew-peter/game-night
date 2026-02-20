'use client';

import { useState } from 'react';
import { CloverBoard } from './CloverBoard';
import { RoundScoring } from './RoundScoring';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { computeTotalScore, maxPossibleScore } from '@/lib/game/soclover/logic';
import { Game, GamePlayer } from '@/lib/supabase/types';
import { Header } from '@/components/shared/Header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

interface SoCloverReviewProps {
  game: Game;
  players: GamePlayer[];
  mySeat: number;
  playerNames: Map<number, string>;
}

export function SoCloverReview({
  game,
  players,
  mySeat,
  playerNames,
}: SoCloverReviewProps) {
  const boardState = game.board_state as unknown as SoCloverBoardState;
  const [viewingClover, setViewingClover] = useState(0);
  const [showScores, setShowScores] = useState(true);

  const totalScore = computeTotalScore(boardState.roundScores);
  const maxScore = maxPossibleScore(boardState.clovers.length);
  const won = game.result === 'win';

  const currentClover = boardState.clovers[viewingClover];
  const currentName = playerNames.get(viewingClover) ?? `Player ${viewingClover + 1}`;
  const numClovers = boardState.clovers.length;

  const prevClover = () =>
    setViewingClover((viewingClover - 1 + numClovers) % numClovers);
  const nextClover = () =>
    setViewingClover((viewingClover + 1) % numClovers);

  return (
    <div
      className={cn(
        'fixed inset-0 overflow-y-auto game-scroll-area',
        won
          ? 'bg-gradient-to-b from-green-800 to-green-950'
          : 'bg-gradient-to-b from-stone-800 to-stone-950'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Header />

      <div className="flex flex-col items-center px-4 py-6 gap-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-2">
          <h1 className={cn(
            'text-2xl font-bold',
            won ? 'text-green-300' : 'text-stone-300'
          )}>
            {won ? 'Great Teamwork!' : 'Game Over'}
          </h1>
          <div className="flex items-center gap-2">
            <Trophy className={cn('w-5 h-5', won ? 'text-amber-400' : 'text-stone-500')} />
            <span className="text-xl font-bold text-white">
              {totalScore} / {maxScore}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={showScores ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowScores(true)}
            className={showScores ? 'bg-green-600 hover:bg-green-500' : ''}
          >
            Scores
          </Button>
          <Button
            variant={!showScores ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowScores(false)}
            className={!showScores ? 'bg-green-600 hover:bg-green-500' : ''}
          >
            View Clovers
          </Button>
        </div>

        {showScores ? (
          <RoundScoring
            roundScores={boardState.roundScores}
            spectatorOrder={boardState.spectatorOrder}
            playerNames={playerNames}
            totalScore={totalScore}
            maxScore={maxScore}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {/* Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevClover}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="text-center min-w-[140px]">
                <span className="text-sm font-semibold text-white">
                  {currentName}
                </span>
                {currentClover.score !== null && (
                  <span className="text-amber-400 text-sm font-bold ml-1.5">
                    {currentClover.score} pts
                  </span>
                )}
                <p className="text-[0.6rem] text-stone-400 mt-0.5">
                  {viewingClover + 1} of {numClovers}
                </p>
              </div>
              <button
                onClick={nextClover}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Clover board */}
            <CloverBoard
              cards={boardState.keywordCards}
              placements={currentClover.cardIndices}
              rotations={currentClover.rotations}
              clues={currentClover.clues}
            />

            {/* Dot indicators */}
            <div className="flex gap-1.5">
              {boardState.clovers.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setViewingClover(i)}
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all',
                    i === viewingClover
                      ? 'bg-green-400 scale-125'
                      : 'bg-white/20 hover:bg-white/40'
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
