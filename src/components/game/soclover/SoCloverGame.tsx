'use client';

import { useMemo } from 'react';
import { Header } from '@/components/shared/Header';
import { GameChat } from '@/components/game/GameChat';
import { Reactions } from '@/components/game/Reactions';
import { ClueWritingPhase } from './ClueWritingPhase';
import { ResolutionPhase } from './ResolutionPhase';
import { SpectatorWaiting } from './SpectatorWaiting';
import { SoCloverReview } from './SoCloverReview';
import { RoundResultOverlay } from './RoundResultOverlay';
import { Game, Seat, GamePlayer, getOtherPlayers } from '@/lib/supabase/types';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { getCurrentSpectatorSeat } from '@/lib/game/soclover/logic';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

function CloverIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c-1.5 0-3 1.2-3 3.5 0 1.3.6 2.5 1.5 3.2C9 8.2 7.5 7.5 6 7.5 3.8 7.5 2 9 2 11s1.8 3.5 4 3.5c1.5 0 3-.7 4.5-1.2-.9.7-1.5 1.9-1.5 3.2 0 2.3 1.5 3.5 3 3.5s3-1.2 3-3.5c0-1.3-.6-2.5-1.5-3.2 1.5.5 3 1.2 4.5 1.2 2.2 0 4-1.5 4-3.5s-1.8-3.5-4-3.5c-1.5 0-3 .7-4.5 1.2.9-.7 1.5-1.9 1.5-3.2C15 3.2 13.5 2 12 2z"/>
    </svg>
  );
}

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
      const name = p.user_id === user.id
        ? user.username
        : (p.user?.username ?? `Player ${p.seat + 1}`);
      map.set(p.seat, name);
    }
    return map;
  }, [players, user]);

  const chatOtherPlayers = useMemo(
    () => getOtherPlayers(players, user.id).map(p => ({
      userId: p.user_id,
      name: p.user?.username ?? `Player ${p.seat + 1}`,
    })),
    [players, user.id]
  );

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
  const roundIdx = boardState.currentSpectatorIdx;
  const totalRounds = boardState.spectatorOrder.length;
  const showRoundResult = isResolution && boardState.lastRoundResult != null;

  return (
    <div className="game-viewport fixed inset-0 bg-gradient-to-b from-green-900 via-emerald-800 to-green-950 flex flex-col overflow-hidden">
      <Header />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-green-800/50 border-b border-green-700/30">
        <div className="flex items-center gap-1.5">
          <CloverIcon className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-green-200">
            So Clover!
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {isClueWriting && (
            <span className="bg-green-700/50 text-green-200 px-2 py-0.5 rounded-full font-medium">
              Writing Clues
            </span>
          )}
          {isResolution && (
            <>
              <span className="bg-amber-700/50 text-amber-200 px-2 py-0.5 rounded-full font-medium">
                Round {roundIdx + 1}/{totalRounds}
              </span>
              {isSpectator && (
                <span className="bg-stone-700/50 text-stone-300 px-2 py-0.5 rounded-full">
                  Spectating
                </span>
              )}
            </>
          )}
          <div className="flex items-center gap-1 text-green-300/60">
            <Users className="w-3 h-3" />
            <span>{players.length}</span>
          </div>
        </div>
      </div>

      {/* Chat + emoji strip */}
      <div className="shrink-0 flex items-center justify-end gap-1 px-2 py-1 bg-green-900/30">
        <Reactions gameId={game.id} playerId={user.id} compact />
        <GameChat
          gameId={game.id}
          playerId={user.id}
          playerName={user.username}
          otherPlayers={chatOtherPlayers}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto game-scroll-area">
        {isClueWriting && (
          <ClueWritingPhase
            boardState={boardState}
            mySeat={mySeat}
            gameId={game.id}
            playerNames={playerNames}
            onSubmitted={onGameUpdated}
          />
        )}

        {showRoundResult && (
          <RoundResultOverlay
            boardState={boardState}
            result={boardState.lastRoundResult!}
            mySeat={mySeat}
            gameId={game.id}
            playerNames={playerNames}
            totalPlayers={players.length}
          />
        )}

        {isResolution && !showRoundResult && isSpectator && (
          <SpectatorWaiting
            boardState={boardState}
            mySeat={mySeat}
            playerNames={playerNames}
          />
        )}

        {isResolution && !showRoundResult && !isSpectator && (
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
