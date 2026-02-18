'use client';

import { Game, Move, Seat } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded, getRemainingAgentsPerSeat } from '@/lib/game/gameLogic';
import { cn } from '@/lib/utils';
import { TappableClueWord } from './TappableClueWord';
import { Reactions } from './Reactions';
import { PresenceIndicator } from './PresenceIndicator';
import { GameChat } from './GameChat';

interface GameStatusProps {
  game: Game;
  mySeat: Seat;
  opponentName?: string;
  opponentId?: string;
  currentClue?: Move | null;
  guessCount?: number;
  userId?: string;
  userName?: string;
}

export function GameStatus({ game, mySeat, opponentName, opponentId, currentClue, guessCount = 0, userId, userName }: GameStatusProps) {
  const isClueGiver = game.current_turn === mySeat;
  const isCluePhase = game.current_phase === 'clue';
  const isGuessPhase = game.current_phase === 'guess';
  const inSuddenDeath = game.sudden_death === true;
  const lastClueTurn = !inSuddenDeath && game.timer_tokens <= 0;

  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const remaining = getRemainingAgentsPerSeat(game);

  // remaining[mySeat] = light green cards on MY board = cards my partner needs to guess
  // remaining[otherSeat] = light green cards on THEIR board = cards I need to guess
  const otherSeat = mySeat === 0 ? 1 : 0;
  const theirRemaining = remaining[mySeat] ?? 0;     // cards on MY key that THEY need to find
  const myRemaining = remaining[otherSeat] ?? 0;      // cards on THEIR key that I need to find

  let statusText = '';
  let isActive = false;

  if (inSuddenDeath) {
    if (isGuessPhase && !isClueGiver) {
      statusText = '💀 SUDDEN DEATH — GUESS!';
      isActive = true;
    } else {
      statusText = `💀 ${opponentName || 'Partner'} guessing...`;
    }
  } else if (lastClueTurn) {
    if (isGuessPhase && !isClueGiver) {
      statusText = '⏱ FINAL CLUE — GUESS!';
      isActive = true;
    } else {
      statusText = `⏱ ${opponentName || 'Partner'} guessing...`;
    }
  } else if (isClueGiver) {
    if (isCluePhase) {
      statusText = '⚡ GIVE A CLUE';
      isActive = true;
    } else {
      statusText = `${opponentName || 'Partner'} guessing...`;
    }
  } else {
    if (isGuessPhase) {
      statusText = '⚡ YOUR TURN TO GUESS';
      isActive = true;
    } else {
      statusText = `${opponentName || 'Partner'} giving clue...`;
    }
  }

  return (
    <div className="bg-stone-700 px-3 py-2">
      <div className="max-w-md mx-auto space-y-2">
        {/* Row 1: Turn + Timer + Score */}
        <div className="flex items-center justify-between">
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-bold',
            isActive ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
          )}>
            {statusText}
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-1 text-xs font-bold',
              game.timer_tokens <= 2 ? 'text-red-400' : 'text-amber-400'
            )}>
              <span>⏱</span>
              <span>{game.timer_tokens}</span>
            </div>
            <div className="text-xs font-bold text-white">
              <span className="text-emerald-400">{agentsFound}</span>
              <span className="text-stone-400">/{totalAgents}</span>
            </div>
            {userId && (
              <div className="relative">
                <Reactions gameId={game.id} playerId={userId} compact />
              </div>
            )}
            {userId && (
              <div className="relative">
                <GameChat
                  gameId={game.id}
                  playerId={userId}
                  playerName={userName || 'You'}
                  otherPlayers={opponentId ? [{ userId: opponentId, name: opponentName || 'Partner' }] : []}
                  opponentId={opponentId}
                  opponentName={opponentName}
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Current clue OR remaining counts */}
        {currentClue ? (
          <div className="flex items-center justify-center gap-2 py-1 bg-stone-800 rounded">
            <span className="text-stone-400 text-xs">CLUE:</span>
            <TappableClueWord word={(currentClue.clue_word || '').toUpperCase()} className="text-white font-black text-lg" />
            <span className="text-amber-400 font-bold">{currentClue.clue_number}</span>
            {guessCount > 0 && (
              <span className="text-stone-400 text-xs">• {guessCount} guessed</span>
            )}
          </div>
        ) : (
          <div className="flex justify-center text-xs text-stone-300">
            <span>{opponentName || 'They'}: <span className="text-emerald-400 font-bold">{theirRemaining}</span> to find</span>
          </div>
        )}

        {/* Partner presence indicator */}
        {userId && game.status === 'playing' && (
          <PresenceIndicator
            gameId={game.id}
            playerId={userId}
            opponentName={opponentName}
            isMyTurn={isClueGiver ? isCluePhase : isGuessPhase}
            phase={game.current_phase}
            isClueGiver={isClueGiver}
          />
        )}
      </div>
    </div>
  );
}
