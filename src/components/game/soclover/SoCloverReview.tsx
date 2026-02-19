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
import { Trophy, ChevronLeft, ChevronRight, Clover } from 'lucide-react';

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

  return (
    <div
      className={cn(
        'fixed inset-0 overflow-y-auto game-scroll-area',
        won
          ? 'bg-gradient-to-b from-emerald-900 to-emerald-950'
          : 'bg-gradient-to-b from-stone-800 to-stone-950'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Header />

      <div className="flex flex-col items-center px-4 py-6 gap-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Hero */}
        <div className="flex flex-col items-center gap-2">
          <Clover className={cn(
            'w-10 h-10',
            won ? 'text-emerald-400' : 'text-stone-500'
          )} />
          <h1 className={cn(
            'text-2xl font-bold',
            won ? 'text-emerald-300' : 'text-stone-300'
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

        {/* Toggle */}
        <div className="flex gap-2">
          <Button
            variant={showScores ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowScores(true)}
            className={showScores ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
          >
            Scores
          </Button>
          <Button
            variant={!showScores ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowScores(false)}
            className={!showScores ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
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
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewingClover(
                    (viewingClover - 1 + boardState.clovers.length) %
                      boardState.clovers.length
                  )
                }
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-white min-w-[100px] text-center">
                {currentName}&apos;s Clover
                {currentClover.score !== null && (
                  <span className="text-amber-400 ml-1">({currentClover.score} pts)</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewingClover(
                    (viewingClover + 1) % boardState.clovers.length
                  )
                }
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <CloverBoard
              cards={boardState.keywordCards}
              placements={currentClover.cardIndices}
              rotations={currentClover.rotations}
              clues={currentClover.clues}
            />
          </div>
        )}
      </div>
    </div>
  );
}
