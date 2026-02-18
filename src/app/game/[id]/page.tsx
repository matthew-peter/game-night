'use client';

import { useEffect, useState, useCallback, useRef, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { GameBoard } from '@/components/game/GameBoard';
import { GameStatus } from '@/components/game/GameStatus';
import { ClueInput } from '@/components/game/ClueInput';
import { GameActions } from '@/components/game/GameActions';
import { GameReview } from '@/components/game/GameReview';
import { InlineHistory } from '@/components/game/InlineHistory';
import { SetupPhase } from '@/components/game/SetupPhase';
import { ScrabbleGame } from '@/components/game/scrabble/ScrabbleGame';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Game, Move, Seat, GamePlayer, getOtherPlayers, findSeat } from '@/lib/supabase/types';
import { processGuess, getNextSeat, getRemainingAgentsPerSeat } from '@/lib/game/gameLogic';
import { toast } from 'sonner';

function GamePageContent({ gameId }: { gameId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const {
    game,
    setGame,
    updateGame,
    moves,
    setMoves,
    addMove,
    mergeMoves,
    players,
    setPlayers,
    clearSelectedWords,
  } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [mySeat, setMySeat] = useState<Seat | undefined>(undefined);
  const [completionSynced, setCompletionSynced] = useState(false);
  const [assassinAnimating, setAssassinAnimating] = useState(false);
  const isSubmittingGuess = useRef(false);
  const gameViewportRef = useRef<HTMLDivElement>(null);

  // Derived: opponents (all players that aren't me)
  const opponents = useMemo(
    () => (user ? getOtherPlayers(players, user.id) : []),
    [players, user]
  );
  const primaryOpponent = opponents[0]; // For 2-player games

  // ── Lock body scroll for iOS PWA ───────────────────────────────────────
  useEffect(() => {
    document.body.classList.add('game-page-active');
    return () => {
      document.body.classList.remove('game-page-active');
    };
  }, []);

  // ── Visual viewport tracking (keyboard-aware layout) ──────────────────
  useEffect(() => {
    const vv = window.visualViewport;
    const el = gameViewportRef.current;
    if (!vv || !el) return;

    const update = () => {
      el.style.height = `${vv.height}px`;
      el.style.bottom = 'auto';
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      el.style.height = '';
      el.style.bottom = '';
    };
  }, []);

  // ── Sync helpers ──────────────────────────────────────────────────────
  const syncFromServer = useCallback(async () => {
    if (!gameId) return;
    const [gameRes, movesRes] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true }),
    ]);
    if (gameRes.data) setGame(gameRes.data);
    if (movesRes.data) mergeMoves(movesRes.data);
  }, [gameId, supabase, setGame, mergeMoves]);

  const syncMovesFromServer = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from('moves')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    if (data) mergeMoves(data);
  }, [gameId, supabase, mergeMoves]);

  // ── Visibility change handler ─────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !user) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameId, user, syncFromServer]);

  // ── Fetch game, players, moves + subscribe to realtime ────────────────
  useEffect(() => {
    if (!gameId || !user) return;

    const fetchGame = async () => {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !gameData) {
        console.error('[GamePage] fetch error:', gameError, 'gameId:', gameId);
        toast.error(gameError?.message ? `Error: ${gameError.message}` : 'Game not found');
        router.push('/dashboard');
        return;
      }

      setGame(gameData);

      if ((gameData as Game).status === 'completed') {
        setCompletionSynced(true);
      }

      // Fetch game_players with user info
      const { data: playersData } = await supabase
        .from('game_players')
        .select('*, user:users(username)')
        .eq('game_id', gameId)
        .order('seat', { ascending: true });

      const gamePlayers: GamePlayer[] = playersData ?? [];
      setPlayers(gamePlayers);

      // Determine my seat
      const seat = findSeat(gamePlayers, user.id);
      if (seat === undefined) {
        toast.error('You are not a player in this game');
        router.push('/dashboard');
        return;
      }
      setMySeat(seat);

      // Fetch moves
      const { data: movesData } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (movesData) {
        setMoves(movesData);
      }

      setLoading(false);
    };

    fetchGame();

    // Subscribe to game changes
    const gameChannel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game;
          setGame(updatedGame);
          syncMovesFromServer();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          toast.info('This game has been deleted');
          router.push('/dashboard');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          syncFromServer();
        }
      });

    // Subscribe to moves
    const movesChannel = supabase
      .channel(`moves-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMove = payload.new as Move;
          addMove(newMove);
        }
      )
      .subscribe();

    // Periodic sync
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(movesChannel);
      clearInterval(syncInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user]);

  // ── Handle giving a clue ──────────────────────────────────────────────
  const handleGiveClue = useCallback(async (clue: string, intendedWordIndices: number[]) => {
    if (!game || !user || mySeat === undefined) return;

    const clueNumber = intendedWordIndices.length;

    updateGame({
      current_phase: 'guess',
      timer_tokens: Math.max(0, game.timer_tokens - 1),
      // Don't set sudden_death yet — guesser gets their full normal turn first.
      // Sudden death activates when the turn ends.
    });
    clearSelectedWords();

    try {
      const res = await fetch(`/api/games/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'clue',
          clueWord: clue,
          intendedWords: intendedWordIndices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to give clue');
        await syncFromServer();
        return;
      }

      await syncFromServer();
      // Notifications are now sent server-side from the move API
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    }
  }, [game, user, mySeat, clearSelectedWords, updateGame, syncFromServer]);

  // ── Handle guessing a word ────────────────────────────────────────────
  const handleGuess = useCallback(async (wordIndex: number) => {
    if (!game || !user || mySeat === undefined) return;

    if (isSubmittingGuess.current) return;
    isSubmittingGuess.current = true;

    try {
      const result = processGuess(game, wordIndex, mySeat);
      const playerCount = game.key_card.length;

      const optimisticUpdates: Partial<Game> = {
        board_state: result.newBoardState,
      };

      if (result.cardType === 'assassin') {
        setAssassinAnimating(true);
        setTimeout(() => setAssassinAnimating(false), 2500);
      }

      if (result.gameOver) {
        optimisticUpdates.status = 'completed';
        optimisticUpdates.result = result.won ? 'win' : 'loss';
      } else if (result.turnEnds) {
        // Wrong guess — turn switches
        optimisticUpdates.current_turn = mySeat;
        if (game.timer_tokens <= 0 && !game.sudden_death) {
          // Last clue turn just ended — transition to sudden death
          optimisticUpdates.current_phase = 'guess';
          optimisticUpdates.sudden_death = true;
        } else if (game.sudden_death) {
          // Already in sudden death (shouldn't reach here for bystander since gameOver would be true)
          optimisticUpdates.current_phase = 'guess';
        } else {
          optimisticUpdates.current_phase = 'clue';
        }
      } else if (game.sudden_death) {
        // Agent found in actual sudden death — check if side is cleared
        const clueGiverSeat = game.current_turn;
        const tempGame = { ...game, board_state: result.newBoardState };
        const remaining = getRemainingAgentsPerSeat(tempGame);
        const agentsLeftOnSide = remaining[clueGiverSeat] ?? 0;
        if (agentsLeftOnSide === 0) {
          optimisticUpdates.current_turn = getNextSeat(clueGiverSeat, playerCount);
        }
      }
      updateGame(optimisticUpdates);

      const res = await fetch(`/api/games/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'guess',
          guessIndex: wordIndex,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to guess');
        await syncFromServer();
      } else {
        await syncFromServer();
      }
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    } finally {
      isSubmittingGuess.current = false;
    }
  }, [game, user, mySeat, updateGame, syncFromServer]);

  // ── Handle ending turn ────────────────────────────────────────────────
  const handleEndTurn = useCallback(async () => {
    if (!game || !user || mySeat === undefined) return;

    const alreadySuddenDeath = game.sudden_death === true;
    const enteringSuddenDeath = !alreadySuddenDeath && game.timer_tokens <= 0;
    const effectiveSuddenDeath = alreadySuddenDeath || enteringSuddenDeath;
    const playerCount = game.key_card.length;

    if (effectiveSuddenDeath) {
      const remaining = getRemainingAgentsPerSeat(game);
      const myKeyRemaining = remaining[mySeat] ?? 0;
      if (myKeyRemaining === 0) {
        toast.error('Cannot end turn — your partner has no agents left to find');
        return;
      }
    }

    updateGame({
      current_turn: mySeat,
      current_phase: effectiveSuddenDeath ? 'guess' : 'clue',
      ...(enteringSuddenDeath ? { sudden_death: true } : {}),
    });

    try {
      const res = await fetch(`/api/games/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveType: 'end_turn' }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to end turn');
      }
      await syncFromServer();
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    }
  }, [game, user, mySeat, updateGame, syncFromServer]);

  // ── Assassin animation delay for observer ─────────────────────────────
  const prevGameStatus = useRef(game?.status);
  useEffect(() => {
    if (
      prevGameStatus.current !== 'completed' &&
      game?.status === 'completed' &&
      game?.result === 'loss' &&
      !assassinAnimating
    ) {
      const hasAssassin = Object.values(game.board_state.revealed).some(
        (r) => r.type === 'assassin'
      );
      if (hasAssassin) {
        setAssassinAnimating(true);
        setTimeout(() => setAssassinAnimating(false), 2500);
      }
    }
    prevGameStatus.current = game?.status;
  }, [game?.status, game?.result, game?.board_state.revealed, assassinAnimating]);

  // ── Final sync when game completes ────────────────────────────────────
  useEffect(() => {
    if (game?.status === 'completed' && !completionSynced) {
      syncFromServer()
        .then(() => setCompletionSynced(true))
        .catch(() => setCompletionSynced(true));
    }
  }, [game?.status, completionSynced, syncFromServer]);

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-stone-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  if (!game || mySeat === undefined) {
    return null;
  }

  // ── Scrabble: render dedicated Scrabble game component ─────────────────
  if (game.game_type === 'scrabble') {
    return (
      <ScrabbleGame
        game={game}
        mySeat={mySeat}
        user={{ id: user.id, username: user.username }}
        players={players}
        onGameUpdated={syncFromServer}
      />
    );
  }

  // ── Codenames: Setup phase: word swaps before gameplay ─────────────────
  const setup = game.board_state.setup;
  const inSetupPhase =
    game.status === 'playing' &&
    setup?.enabled &&
    !setup.ready.every(Boolean);

  if (inSetupPhase) {
    return (
      <SetupPhase
        game={game}
        mySeat={mySeat}
        opponentName={primaryOpponent?.user?.username}
        onGameUpdated={syncFromServer}
      />
    );
  }

  // Show review if game is completed
  if (game.status === 'completed' && !assassinAnimating) {
    if (!completionSynced) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-stone-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      );
    }

    // Build name map from players array
    const nameForSeat = (seat: Seat) => {
      const p = players.find(pl => pl.seat === seat);
      if (!p) return `Player ${seat + 1}`;
      if (p.user_id === user.id) return user.username;
      return p.user?.username ?? `Player ${seat + 1}`;
    };

    return (
      <GameReview
        game={game}
        moves={moves}
        mySeat={mySeat}
        seatNames={game.key_card.map((_, i) => nameForSeat(i))}
      />
    );
  }

  const isMyTurn = game.current_turn === mySeat;
  const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;

  const lastClue = moves.filter(m => m.move_type === 'clue').slice(-1)[0] || null;
  // Show the clue during the last clue's guess phase (sudden_death flag not yet set).
  // Only hide the clue once actual sudden death is active.
  const currentClue = game.current_phase === 'guess' && !game.sudden_death ? lastClue : null;
  const hasActiveClue = game.current_phase === 'guess' && lastClue !== null;

  const lastTurnBoundary = (() => {
    for (let i = moves.length - 1; i >= 0; i--) {
      if (moves[i].move_type === 'clue' || moves[i].move_type === 'end_turn') {
        return i;
      }
    }
    return -1;
  })();
  const guessCount = lastTurnBoundary >= 0
    ? moves.slice(lastTurnBoundary + 1).filter(m => m.move_type === 'guess').length
    : moves.filter(m => m.move_type === 'guess').length;

  // Build player ID→name map for InlineHistory
  const playerNameMap = new Map<string, string>();
  for (const p of players) {
    const name = p.user_id === user.id ? user.username : (p.user?.username ?? `Player ${p.seat + 1}`);
    playerNameMap.set(p.user_id, name);
  }

  return (
    <div ref={gameViewportRef} className="game-viewport fixed inset-0 bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col overflow-hidden">
      <Header />

      <GameStatus
        game={game}
        mySeat={mySeat}
        opponentName={primaryOpponent?.user?.username}
        opponentId={primaryOpponent?.user_id}
        currentClue={currentClue}
        guessCount={guessCount}
        userId={user?.id}
        userName={user?.username}
      />

      <main className="flex-1 min-h-0 overflow-y-auto game-scroll-area py-2 px-1 flex flex-col">
        <GameBoard
          game={game}
          mySeat={mySeat}
          onGuess={handleGuess}
          hasActiveClue={hasActiveClue}
        />

        {isMyTurn && game.current_phase === 'clue' && game.timer_tokens > 0 && !game.sudden_death && (
          <div className="mx-1 mt-2">
            <ClueInput
              game={game}
              mySeat={mySeat}
              onGiveClue={handleGiveClue}
              hasActiveClue={hasActiveClue}
            />
          </div>
        )}

        <div className="flex-1 mt-2 bg-stone-800/50 rounded-lg mx-1 min-h-[100px] max-h-[180px] overflow-y-auto game-scroll-area">
          <InlineHistory
            moves={moves}
            mySeat={mySeat}
            myUserId={user.id}
            playerNameMap={playerNameMap}
            words={game.words}
          />
        </div>
      </main>

      <GameActions
        game={game}
        mySeat={mySeat}
        onEndTurn={handleEndTurn}
        guessCount={guessCount}
      />
    </div>
  );
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <AuthProvider>
      <GamePageContent gameId={resolvedParams.id} />
    </AuthProvider>
  );
}
