'use client';

import { useMemo } from 'react';
import { Header } from '@/components/shared/Header';
import { ClueWritingPhase } from './ClueWritingPhase';
import { ResolutionPhase } from './ResolutionPhase';
import { SpectatorWaiting } from './SpectatorWaiting';
import { SoCloverReview } from './SoCloverReview';
import { RoundScoring } from './RoundScoring';
import { Game, Seat, GamePlayer, getOtherPlayers } from '@/lib/supabase/types';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import {
  getCurrentSpectatorSeat,
  computeTotalScore,
  maxPossibleScore,
} from '@/lib/game/soclover/logic';
import { cn } from '@/lib/utils';
import { Clover, Users } from 'lucide-react';

interface SoCloverGameProps {
  game: Game;
  mySeat: Seat;
  user: { id: string; username: string };
  players: GamePlayer[];
  onGameUpdated: () => void;
}

export function SoCloverGame({
  game,
  mySeat,
  user,
  players,
  onGameUpdated,
}: SoCloverGameProps) {
  const boardState = game.board_state as unknown as SoCloverBoardState;

  const playerNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of players) {
      const name = p.user_id === user.id ? user.username : (p.user?.username ?? `Player ${p.seat + 1}`);
      map.set(p.seat, name);
    }
    return map;
  }, [players, user]);

  if (game.status === 'completed') {
    return (
      <SoCloverReview
        game={game}
        players={players}
        mySeat={mySeat}
        playerNames={playerNames}
      />
    );
  }

  const spectatorSeat = getCurrentSpectatorSeat(boardState);
  const isSpectator = spectatorSeat === mySeat;
  const isClueWriting = game.current_phase === 'clue_writing';
  const isResolution = game.current_phase === 'resolution';

  const spectatorName = spectatorSeat != null
    ? (playerNames.get(spectatorSeat) ?? `Player ${spectatorSeat + 1}`)
    : null;

  const roundIdx = boardState.currentSpectatorIdx;
  const totalRounds = boardState.spectatorOrder.length;

  return (
    <div className="game-viewport fixed inset-0 bg-gradient-to-b from-emerald-950 via-emerald-900 to-stone-900 flex flex-col overflow-hidden">
      <Header />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-900/60 border-b border-emerald-800/40">
        <div className="flex items-center gap-2">
          <Clover className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">
            So Clover
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          {isClueWriting && (
            <span className="bg-emerald-800/60 text-emerald-300 px-2 py-0.5 rounded-full">
              Writing Clues
            </span>
          )}
          {isResolution && (
            <>
              <span className="bg-amber-800/60 text-amber-300 px-2 py-0.5 rounded-full">
                Round {roundIdx + 1}/{totalRounds}
              </span>
              {isSpectator && (
                <span className="bg-stone-700/60 text-stone-300 px-2 py-0.5 rounded-full">
                  You&apos;re Spectating
                </span>
              )}
            </>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{players.length}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto game-scroll-area">
        {isClueWriting && (
          <ClueWritingPhase
            boardState={boardState}
            mySeat={mySeat}
            gameId={game.id}
            onSubmitted={onGameUpdated}
          />
        )}

        {isResolution && isSpectator && (
          <SpectatorWaiting
            boardState={boardState}
            mySeat={mySeat}
            playerNames={playerNames}
          />
        )}

        {isResolution && !isSpectator && (
          <ResolutionPhase
            boardState={boardState}
            mySeat={mySeat}
            gameId={game.id}
            playerNames={playerNames}
            onUpdated={onGameUpdated}
          />
        )}
      </main>
    </div>
  );
}
