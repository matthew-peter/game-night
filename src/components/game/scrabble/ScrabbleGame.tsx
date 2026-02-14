'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ScrabbleBoard } from './ScrabbleBoard';
import { TileRack } from './TileRack';
import { ScrabbleScoreboard } from './ScrabbleScoreboard';
import { ScrabbleActions } from './ScrabbleActions';
import { BlankTileDialog } from './BlankTileDialog';
import { LastPlayInfo } from './LastPlayInfo';
import { Header } from '@/components/shared/Header';
import { Game, Seat, GamePlayer, findSeat, getOtherPlayers } from '@/lib/supabase/types';
import { ScrabbleBoardState, TilePlacement } from '@/lib/game/scrabble/types';
import { createClient } from '@/lib/supabase/client';
import { sendTurnNotification } from '@/lib/notifications';
import { toast } from 'sonner';

interface ScrabbleGameProps {
  game: Game;
  mySeat: Seat;
  user: { id: string; username: string };
  players: GamePlayer[];
  onGameUpdated: () => void;
}

export function ScrabbleGame({
  game,
  mySeat,
  user,
  players,
  onGameUpdated,
}: ScrabbleGameProps) {
  const boardState = game.board_state as unknown as ScrabbleBoardState;
  const isMyTurn = game.current_turn === mySeat;
  const myRack = boardState.racks[mySeat] ?? [];
  const opponents = useMemo(() => getOtherPlayers(players, user.id), [players, user.id]);

  // UI state
  const [pendingPlacements, setPendingPlacements] = useState<TilePlacement[]>([]);
  const [selectedRackIndices, setSelectedRackIndices] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'play' | 'exchange'>('play');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blankDialog, setBlankDialog] = useState<{
    open: boolean;
    rackIndex: number;
    targetRow: number;
    targetCol: number;
  }>({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 });

  // Track which rack tile is being dragged
  const dragTileIndex = useRef<number | null>(null);

  // Reset pending state when turn changes
  useEffect(() => {
    setPendingPlacements([]);
    setSelectedRackIndices(new Set());
    setMode('play');
  }, [game.current_turn, game.board_state]);

  // ── Available rack tiles (not yet placed on board) ────────────────────
  const availableRackTiles = useMemo(() => {
    const usedIndices = new Set<number>();
    for (const p of pendingPlacements) {
      // Find the rack index used for this placement
      const rackIdx = findRackIndexForPlacement(myRack, p, usedIndices);
      if (rackIdx !== -1) usedIndices.add(rackIdx);
    }
    return myRack.map((tile, i) => ({
      tile,
      index: i,
      used: usedIndices.has(i),
    }));
  }, [myRack, pendingPlacements]);

  const displayedRackTiles = availableRackTiles
    .filter(t => !t.used)
    .map(t => ({ letter: t.tile, originalIndex: t.index }));

  // ── Place a tile on the board ─────────────────────────────────────────
  const placeTileOnBoard = useCallback((row: number, col: number, rackIndex: number) => {
    const tile = myRack[rackIndex];
    if (!tile) return;

    if (tile === '_') {
      // Blank tile — show letter picker
      setBlankDialog({ open: true, rackIndex, targetRow: row, targetCol: col });
      return;
    }

    setPendingPlacements(prev => [
      ...prev,
      { row, col, letter: tile, isBlank: false },
    ]);
    setSelectedRackIndices(new Set());
  }, [myRack]);

  const handleBlankLetterSelected = useCallback((letter: string) => {
    const { rackIndex, targetRow, targetCol } = blankDialog;
    setPendingPlacements(prev => [
      ...prev,
      { row: targetRow, col: targetCol, letter, isBlank: true },
    ]);
    setBlankDialog({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 });
    setSelectedRackIndices(new Set());
  }, [blankDialog]);

  // ── Handle cell drop (from drag or click) ─────────────────────────────
  const handleCellDrop = useCallback((row: number, col: number) => {
    let rackIndex: number;

    if (dragTileIndex.current !== null) {
      // From drag
      rackIndex = displayedRackTiles[dragTileIndex.current]?.originalIndex;
      dragTileIndex.current = null;
    } else if (selectedRackIndices.size === 1) {
      // From click selection
      const selectedDisplayIdx = selectedRackIndices.values().next().value;
      rackIndex = displayedRackTiles[selectedDisplayIdx!]?.originalIndex;
    } else {
      // Pick first available tile
      const firstAvailable = displayedRackTiles[0];
      if (!firstAvailable) return;
      rackIndex = firstAvailable.originalIndex;
    }

    if (rackIndex === undefined || rackIndex === -1) return;
    placeTileOnBoard(row, col, rackIndex);
  }, [displayedRackTiles, selectedRackIndices, placeTileOnBoard]);

  // ── Remove a pending tile from the board ──────────────────────────────
  const handleRemovePending = useCallback((row: number, col: number) => {
    setPendingPlacements(prev =>
      prev.filter(p => !(p.row === row && p.col === col))
    );
  }, []);

  // ── Recall all pending tiles ──────────────────────────────────────────
  const handleRecall = useCallback(() => {
    setPendingPlacements([]);
    setSelectedRackIndices(new Set());
  }, []);

  // ── Rack tile interaction ─────────────────────────────────────────────
  const handleRackTileClick = useCallback((displayIndex: number) => {
    if (mode === 'exchange') {
      setSelectedRackIndices(prev => {
        const next = new Set(prev);
        if (next.has(displayIndex)) next.delete(displayIndex);
        else next.add(displayIndex);
        return next;
      });
    } else {
      // Toggle selection
      setSelectedRackIndices(prev => {
        if (prev.has(displayIndex) && prev.size === 1) return new Set();
        return new Set([displayIndex]);
      });
    }
  }, [mode]);

  const handleDragStart = useCallback((displayIndex: number, e: React.DragEvent) => {
    dragTileIndex.current = displayIndex;
    e.dataTransfer.effectAllowed = 'move';
    // Set some data so the drop event fires
    e.dataTransfer.setData('text/plain', String(displayIndex));
  }, []);

  const handleDragEnd = useCallback(() => {
    dragTileIndex.current = null;
  }, []);

  // ── Submit play ───────────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    if (pendingPlacements.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/games/${game.id}/scrabble-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'place_tiles',
          placements: pendingPlacements,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Invalid play');
        return;
      }

      toast.success(`+${data.totalScore} points!`);
      setPendingPlacements([]);
      setSelectedRackIndices(new Set());
      onGameUpdated();

      // Notify opponents
      for (const opp of opponents) {
        sendTurnNotification(
          game.id,
          opp.user_id,
          user.username,
          `${user.username} played — your turn!`
        );
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, pendingPlacements, isSubmitting, onGameUpdated, opponents, user.username]);

  // ── Submit exchange ───────────────────────────────────────────────────
  const handleExchange = useCallback(async () => {
    if (selectedRackIndices.size === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const tilesToExchange = Array.from(selectedRackIndices).map(
      displayIdx => displayedRackTiles[displayIdx]?.letter
    ).filter(Boolean);

    try {
      const res = await fetch(`/api/games/${game.id}/scrabble-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'exchange_tiles',
          tiles: tilesToExchange,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Exchange failed');
        return;
      }

      toast.success('Tiles exchanged');
      setSelectedRackIndices(new Set());
      setMode('play');
      onGameUpdated();

      for (const opp of opponents) {
        sendTurnNotification(
          game.id,
          opp.user_id,
          user.username,
          `${user.username} exchanged tiles — your turn!`
        );
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, selectedRackIndices, displayedRackTiles, isSubmitting, onGameUpdated, opponents, user.username]);

  // ── Submit pass ───────────────────────────────────────────────────────
  const handlePass = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/games/${game.id}/scrabble-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveType: 'pass' }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Pass failed');
        return;
      }

      toast.info('Turn passed');
      onGameUpdated();

      for (const opp of opponents) {
        sendTurnNotification(
          game.id,
          opp.user_id,
          user.username,
          `${user.username} passed — your turn!`
        );
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, isSubmitting, onGameUpdated, opponents, user.username]);

  // ── Game over view ────────────────────────────────────────────────────
  if (game.status === 'completed') {
    const maxScore = Math.max(...boardState.scores);
    const winners = boardState.scores
      .map((score, seat) => ({ score, seat }))
      .filter(({ score }) => score === maxScore);

    return (
      <div className="fixed inset-0 bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-3">
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold text-amber-400 mb-2">Game Over!</h2>
            <div className="space-y-1">
              {boardState.scores.map((score, seat) => {
                const p = players.find(pl => pl.seat === seat);
                const name = p?.user_id === user.id ? 'You' : p?.user?.username ?? `Player ${seat + 1}`;
                const isWinner = score === maxScore;
                return (
                  <div
                    key={seat}
                    className={`text-lg ${isWinner ? 'text-amber-300 font-bold' : 'text-stone-400'}`}
                  >
                    {name}: {score} {isWinner ? '🏆' : ''}
                  </div>
                );
              })}
            </div>
          </div>
          <ScrabbleBoard
            cells={boardState.cells}
            pendingPlacements={[]}
            onCellDrop={() => {}}
            onRemovePending={() => {}}
            disabled
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col overflow-hidden">
      <Header />

      <ScrabbleScoreboard
        boardState={boardState}
        players={players}
        currentTurn={game.current_turn}
        mySeat={mySeat}
        userId={user.id}
      />

      {boardState.lastPlay && (
        <LastPlayInfo
          lastPlay={boardState.lastPlay}
          players={players}
          userId={user.id}
        />
      )}

      <main className="flex-1 min-h-0 overflow-y-auto py-2 px-1">
        <ScrabbleBoard
          cells={boardState.cells}
          pendingPlacements={pendingPlacements}
          onCellDrop={handleCellDrop}
          onRemovePending={handleRemovePending}
          disabled={!isMyTurn || isSubmitting}
        />
      </main>

      <div className="shrink-0 pb-safe px-2 pb-2 space-y-1">
        <TileRack
          tiles={displayedRackTiles.map(t => t.letter)}
          selectedIndices={selectedRackIndices}
          onTileClick={handleRackTileClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          disabled={!isMyTurn || isSubmitting}
          mode={mode}
        />

        <ScrabbleActions
          isMyTurn={isMyTurn}
          hasPendingTiles={pendingPlacements.length > 0}
          selectedRackCount={selectedRackIndices.size}
          mode={mode}
          onPlay={handlePlay}
          onExchange={handleExchange}
          onPass={handlePass}
          onRecall={handleRecall}
          onToggleMode={() => {
            setMode(m => m === 'play' ? 'exchange' : 'play');
            setSelectedRackIndices(new Set());
            setPendingPlacements([]);
          }}
          isSubmitting={isSubmitting}
          tilesInBag={boardState.tileBag.length}
        />
      </div>

      <BlankTileDialog
        open={blankDialog.open}
        onSelect={handleBlankLetterSelected}
        onCancel={() => setBlankDialog({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 })}
      />
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────

/** Find which rack index was used for a given pending placement */
function findRackIndexForPlacement(
  rack: string[],
  placement: TilePlacement,
  alreadyUsed: Set<number>
): number {
  const needed = placement.isBlank ? '_' : placement.letter;
  for (let i = 0; i < rack.length; i++) {
    if (!alreadyUsed.has(i) && rack[i] === needed) {
      return i;
    }
  }
  return -1;
}
