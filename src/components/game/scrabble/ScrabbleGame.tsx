'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ScrabbleBoard } from './ScrabbleBoard';
import { TileRack } from './TileRack';
import { ScrabbleScoreboard } from './ScrabbleScoreboard';
import { ScrabbleActions } from './ScrabbleActions';
import { BlankTileDialog } from './BlankTileDialog';
import { WordChecker } from './WordChecker';
import { Header } from '@/components/shared/Header';
import { GameChat } from '@/components/game/GameChat';
import { Game, Seat, GamePlayer, getOtherPlayers } from '@/lib/supabase/types';
import { ScrabbleBoardState, TilePlacement, PlacedTile, DictionaryMode } from '@/lib/game/scrabble/types';
import { Reactions } from '@/components/game/Reactions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Trophy, RotateCcw } from 'lucide-react';

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
  const dictionaryMode: DictionaryMode = boardState.dictionaryMode ?? 'friendly';

  // Chat player list
  const chatOtherPlayers = useMemo(
    () => opponents.map(p => ({
      userId: p.user_id,
      name: p.user?.username ?? `Player ${p.seat + 1}`,
    })),
    [opponents]
  );

  // UI state
  const [pendingPlacements, setPendingPlacements] = useState<TilePlacement[]>([]);
  const [selectedRackIndices, setSelectedRackIndices] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'play' | 'exchange'>('play');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wordCheckerOpen, setWordCheckerOpen] = useState(false);
  const [blankDialog, setBlankDialog] = useState<{
    open: boolean;
    rackIndex: number;
    targetRow: number;
    targetCol: number;
  }>({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 });

  const dragTileIndex = useRef<number | null>(null);

  // Detect the main word formed by current pending tiles
  const formedWord = useMemo(
    () => detectFormedWord(boardState.cells, pendingPlacements),
    [boardState.cells, pendingPlacements]
  );

  // Word validity check state
  const [wordCheckResult, setWordCheckResult] = useState<'valid' | 'invalid' | null>(null);
  const [isCheckingWord, setIsCheckingWord] = useState(false);

  // Reset check result when formed word changes
  useEffect(() => {
    setWordCheckResult(null);
  }, [formedWord]);

  const handleCheckFormedWord = useCallback(async () => {
    if (!formedWord || formedWord.length < 2) return;
    setIsCheckingWord(true);
    try {
      const res = await fetch('/api/games/check-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: formedWord }),
      });
      const data = await res.json();
      setWordCheckResult(data.valid ? 'valid' : 'invalid');
    } catch {
      toast.error('Could not check word');
    } finally {
      setIsCheckingWord(false);
    }
  }, [formedWord]);

  // Reset pending state when turn changes (NOT when board_state ref changes —
  // the periodic sync creates new object refs which would wipe tiles mid-placement)
  useEffect(() => {
    setPendingPlacements([]);
    setSelectedRackIndices(new Set());
    setMode('play');
  }, [game.current_turn]);

  // ── Available rack tiles (not yet placed on board) ────────────────────
  const availableRackTiles = useMemo(() => {
    const usedIndices = new Set<number>();
    for (const p of pendingPlacements) {
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
    const { targetRow, targetCol } = blankDialog;
    setPendingPlacements(prev => [
      ...prev,
      { row: targetRow, col: targetCol, letter, isBlank: true },
    ]);
    setBlankDialog({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 });
    setSelectedRackIndices(new Set());
  }, [blankDialog]);

  // ── Handle cell tap/drop ──────────────────────────────────────────────
  const handleCellDrop = useCallback((row: number, col: number) => {
    let rackIndex: number | undefined;

    if (dragTileIndex.current !== null) {
      rackIndex = displayedRackTiles[dragTileIndex.current]?.originalIndex;
      dragTileIndex.current = null;
    } else if (selectedRackIndices.size === 1) {
      const selectedDisplayIdx = selectedRackIndices.values().next().value;
      rackIndex = displayedRackTiles[selectedDisplayIdx!]?.originalIndex;
    } else {
      // Auto-select first available tile
      const firstAvailable = displayedRackTiles[0];
      if (!firstAvailable) return;
      rackIndex = firstAvailable.originalIndex;
    }

    if (rackIndex === undefined || rackIndex === -1) return;
    placeTileOnBoard(row, col, rackIndex);
  }, [displayedRackTiles, selectedRackIndices, placeTileOnBoard]);

  const handleRemovePending = useCallback((row: number, col: number) => {
    setPendingPlacements(prev =>
      prev.filter(p => !(p.row === row && p.col === col))
    );
  }, []);

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
      setSelectedRackIndices(prev => {
        if (prev.has(displayIndex) && prev.size === 1) return new Set();
        return new Set([displayIndex]);
      });
    }
  }, [mode]);

  const handleDragStart = useCallback((displayIndex: number, e: React.DragEvent) => {
    dragTileIndex.current = displayIndex;
    e.dataTransfer.effectAllowed = 'move';
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
      // Notifications are now sent server-side
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, pendingPlacements, isSubmitting, onGameUpdated]);

  // ── Submit exchange ───────────────────────────────────────────────────
  const handleExchange = useCallback(async () => {
    if (selectedRackIndices.size === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const tilesToExchange = Array.from(selectedRackIndices)
      .map(displayIdx => displayedRackTiles[displayIdx]?.letter)
      .filter((l): l is string => !!l);

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
      // Notifications are now sent server-side
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, selectedRackIndices, displayedRackTiles, isSubmitting, onGameUpdated]);

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
      // Notifications are now sent server-side
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [game.id, isSubmitting, onGameUpdated]);

  // ── Game over view ────────────────────────────────────────────────────
  if (game.status === 'completed') {
    const maxScore = Math.max(...boardState.scores);

    return (
      <div className="fixed inset-0 bg-stone-800 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="max-w-sm mx-auto mb-4">
            <div className="bg-stone-800 rounded-xl border border-stone-700 p-5 text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Game Over</h2>
              </div>

              <div className="space-y-1.5">
                {boardState.scores
                  .map((score, seat) => ({ score, seat }))
                  .sort((a, b) => b.score - a.score)
                  .map(({ score, seat }, rank) => {
                    const p = players.find(pl => pl.seat === seat);
                    const name = p?.user_id === user.id ? 'You' : p?.user?.username ?? `Player ${seat + 1}`;
                    const isWinner = score === maxScore;

                    return (
                      <div
                        key={seat}
                        className={cn(
                          'flex items-center justify-between px-4 py-2 rounded-lg text-sm',
                          isWinner
                            ? 'bg-amber-600/20 border border-amber-500/30'
                            : 'bg-stone-700/40'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-5 text-center text-xs',
                            isWinner ? 'text-amber-400' : 'text-stone-500'
                          )}>
                            {rank + 1}.
                          </span>
                          <span className={cn(
                            'font-medium',
                            isWinner ? 'text-amber-300' : 'text-stone-300',
                          )}>
                            {name}
                          </span>
                        </div>
                        <span className={cn(
                          'font-bold tabular-nums',
                          isWinner ? 'text-amber-400' : 'text-stone-500'
                        )}>
                          {score}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Dashboard
              </a>
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

  // ── Active game layout ────────────────────────────────────────────────
  const hasSelectedRackTile = mode === 'play' && selectedRackIndices.size === 1;

  return (
    <div className="fixed inset-0 bg-[#F5F0E8] flex flex-col overflow-hidden">
      <Header />

      {/* Scoreboard — full-width colored banner */}
      <div className="shrink-0">
        <ScrabbleScoreboard
          boardState={boardState}
          players={players}
          currentTurn={game.current_turn}
          mySeat={mySeat}
          userId={user.id}
        />
      </div>

      {/* Emoji + chat strip */}
      <div className="shrink-0 flex items-center justify-end gap-1 px-2 py-1">
        <Reactions gameId={game.id} playerId={user.id} compact />
        <GameChat
          gameId={game.id}
          playerId={user.id}
          playerName={user.username}
          otherPlayers={chatOtherPlayers}
        />
      </div>

      {/* Board */}
      <div className="shrink-0 px-1">
        <ScrabbleBoard
          cells={boardState.cells}
          pendingPlacements={pendingPlacements}
          onCellDrop={handleCellDrop}
          onRemovePending={handleRemovePending}
          disabled={!isMyTurn || isSubmitting}
          hasSelectedTile={hasSelectedRackTile}
          isMyTurn={isMyTurn}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1 max-h-2" />

      {/* Rack + actions — bottom */}
      <div className="shrink-0" style={{ paddingBottom: 'calc(4px + env(safe-area-inset-bottom))' }}>
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
          hasSelectedRackTile={hasSelectedRackTile}
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
          onCheckWord={() => setWordCheckerOpen(true)}
          onCheckFormedWord={handleCheckFormedWord}
          isSubmitting={isSubmitting}
          tilesInBag={boardState.tileBag.length}
          dictionaryMode={dictionaryMode}
          formedWord={formedWord}
          wordCheckResult={wordCheckResult}
          isCheckingWord={isCheckingWord}
        />
      </div>

      <BlankTileDialog
        open={blankDialog.open}
        onSelect={handleBlankLetterSelected}
        onCancel={() => setBlankDialog({ open: false, rackIndex: -1, targetRow: -1, targetCol: -1 })}
      />

      <WordChecker
        open={wordCheckerOpen}
        onClose={() => setWordCheckerOpen(false)}
      />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Detect the main word formed by pending placements on the current board.
 * Returns the word string (uppercase), or '' if placements are empty / invalid.
 */
function detectFormedWord(
  cells: (PlacedTile | null)[][],
  placements: TilePlacement[]
): string {
  if (placements.length === 0) return '';

  // Build a test board
  const test = cells.map(row => row.map(c => c?.letter ?? null));
  for (const p of placements) test[p.row][p.col] = p.letter.toUpperCase();

  const allSameRow = placements.every(p => p.row === placements[0].row);
  const allSameCol = placements.every(p => p.col === placements[0].col);

  if (placements.length === 1) {
    // Single tile — pick the longer axis word
    const h = readWord(test, placements[0].row, placements[0].col, 0, 1);
    const v = readWord(test, placements[0].row, placements[0].col, 1, 0);
    return (h.length >= v.length ? h : v);
  }

  if (allSameRow) {
    return readWord(test, placements[0].row, placements[0].col, 0, 1);
  }
  if (allSameCol) {
    return readWord(test, placements[0].row, placements[0].col, 1, 0);
  }
  return '';
}

/** Read a contiguous word through (row,col) along direction (dr,dc). */
function readWord(
  board: (string | null)[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
): string {
  // Find start of word
  let r = row, c = col;
  while (r - dr >= 0 && c - dc >= 0 && r - dr < 15 && c - dc < 15 && board[r - dr][c - dc]) {
    r -= dr;
    c -= dc;
  }
  // Read forward
  let word = '';
  while (r >= 0 && c >= 0 && r < 15 && c < 15 && board[r][c]) {
    word += board[r][c];
    r += dr;
    c += dc;
  }
  return word;
}
