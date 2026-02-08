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
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { processGuess, getNextTurn, getRemainingAgentsPerPlayer } from '@/lib/game/gameLogic';
import { sendTurnNotification } from '@/lib/notifications';
import { toast } from 'sonner';

function GamePageContent({ gameId }: { gameId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // Memoize the Supabase client so it's not recreated on every render.
  // This prevents subscription churn and useEffect re-runs.
  const supabase = useMemo(() => createClient(), []);
  
  const {
    game,
    setGame,
    updateGame,
    moves,
    setMoves,
    addMove,
    mergeMoves,
    opponent,
    setOpponent,
    clearSelectedWords,
  } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [playerRole, setPlayerRole] = useState<CurrentTurn | null>(null);
  const isSubmittingGuess = useRef(false);
  const autoSkipKey = useRef<string | null>(null);

  // ── Sync helpers ──────────────────────────────────────────────────────
  // Refetch game + moves from DB.  Used on visibility change, reconnect,
  // and periodic poll so we never stay stale for long.
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

  // Refetch just moves (lighter — used when we know only moves changed)
  const syncMovesFromServer = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from('moves')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    if (data) mergeMoves(data);
  }, [gameId, supabase, mergeMoves]);

  // ── Visibility change handler (PWA background/foreground) ─────────────
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

  // Fetch game and set up subscriptions
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
        toast.error('Game not found');
        router.push('/dashboard');
        return;
      }

      setGame(gameData);
      
      // Determine player role
      if (gameData.player1_id === user.id) {
        setPlayerRole('player1');
      } else if (gameData.player2_id === user.id) {
        setPlayerRole('player2');
      } else {
        toast.error('You are not a player in this game');
        router.push('/dashboard');
        return;
      }

      // Fetch opponent
      const opponentId = gameData.player1_id === user.id 
        ? gameData.player2_id 
        : gameData.player1_id;
      
      if (opponentId) {
        const { data: opponentData } = await supabase
          .from('users')
          .select('*')
          .eq('id', opponentId)
          .single();
        
        if (opponentData) {
          setOpponent(opponentData);
        }
      }

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

    // Subscribe to game changes (UPDATE and DELETE)
    // When a game UPDATE arrives, also refetch moves — they're almost
    // always correlated and the moves INSERT event may arrive late or
    // be missed entirely on flaky mobile connections.
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
          // Also sync moves — the game update likely came with new moves
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
        // On reconnect, do a full sync to catch anything we missed
        if (status === 'SUBSCRIBED') {
          syncFromServer();
        }
      });

    // Subscribe to moves — still useful for fast updates, but no longer
    // the only path.  addMove deduplicates so double-delivery is safe.
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

    // ── Periodic sync (safety net) ──────────────────────────────────────
    // Every 5 seconds, refetch game + moves.  This catches any realtime
    // events that were dropped due to network issues.  It's cheap (two
    // small selects) and eliminates the entire class of "stale UI" bugs.
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

  // Handle giving a clue — use API route for validation + atomic write
  const handleGiveClue = useCallback(async (clue: string, intendedWordIndices: number[]) => {
    if (!game || !user || !playerRole) return;

    const clueNumber = intendedWordIndices.length;

    // Optimistic update: immediately show guess phase
    updateGame({
      current_phase: 'guess',
      timer_tokens: Math.max(0, game.timer_tokens - 1),
      sudden_death: game.timer_tokens - 1 <= 0 ? true : game.sudden_death,
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

      // Sync from server to get authoritative state + the new move
      await syncFromServer();

      // Notify opponent it's their turn to guess
      if (opponent) {
        sendTurnNotification(
          game.id,
          opponent.id,
          user.username,
          `${user.username} gave clue: "${clue.toUpperCase()}" (${clueNumber}) - Your turn to guess!`
        );
      }
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    }
  }, [game, user, playerRole, clearSelectedWords, opponent, updateGame, syncFromServer]);

  // Handle guessing a word — use API route + optimistic local update
  const handleGuess = useCallback(async (wordIndex: number) => {
    if (!game || !user || !playerRole) return;

    // Prevent multiple simultaneous guesses
    if (isSubmittingGuess.current) return;
    isSubmittingGuess.current = true;

    try {
      // Process guess locally for optimistic update
      const result = processGuess(game, wordIndex, playerRole);

      // Optimistic update — immediately show card flip
      const optimisticUpdates: Partial<Game> = {
        board_state: result.newBoardState,
      };
      if (result.gameOver) {
        optimisticUpdates.status = 'completed';
        optimisticUpdates.result = result.won ? 'win' : 'loss';
      } else if (result.turnEnds) {
        if (game.timer_tokens <= 0 || game.sudden_death) {
          optimisticUpdates.status = 'completed';
          optimisticUpdates.result = 'loss';
        } else {
          optimisticUpdates.current_turn = playerRole;
          optimisticUpdates.current_phase = 'clue';
        }
      } else if (game.sudden_death || game.timer_tokens <= 0) {
        // Agent found in sudden death — check if more agents remain on this side
        const clueGiver = game.current_turn;
        const sideAgents = clueGiver === 'player1'
          ? game.key_card.player1.agents : game.key_card.player2.agents;
        const tempGame = { ...game, board_state: result.newBoardState };
        const remaining = getRemainingAgentsPerPlayer(tempGame);
        const agentsLeftOnSide = clueGiver === 'player1' ? remaining.player1 : remaining.player2;
        if (agentsLeftOnSide === 0) {
          // Switch sides so the other player guesses
          optimisticUpdates.current_turn = getNextTurn(clueGiver);
        }
      }
      updateGame(optimisticUpdates);

      // Send to API
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
        // Sync moves so the game log updates immediately for the guesser
        // (don't wait for realtime INSERT which can be delayed)
        await syncMovesFromServer();
      }
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    } finally {
      isSubmittingGuess.current = false;
    }
  }, [game, user, playerRole, updateGame, syncFromServer, syncMovesFromServer]);

  // Handle ending turn voluntarily — use API route + optimistic update
  const handleEndTurn = useCallback(async () => {
    if (!game || !user || !playerRole) return;

    const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;

    // In sudden death, check if the other player has agents to find
    if (inSuddenDeath) {
      const remaining = getRemainingAgentsPerPlayer(game);
      // After switching, current_turn becomes me (playerRole).
      // The new guesser would be the other player, finding agents on MY key.
      const myKeyRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
      if (myKeyRemaining === 0) {
        toast.error('Cannot end turn — your partner has no agents left to find');
        return;
      }
    }

    // Optimistic update
    updateGame({
      current_turn: playerRole,
      current_phase: inSuddenDeath ? 'guess' : 'clue',
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
        await syncFromServer();
      }
    } catch {
      toast.error('Network error — please try again');
      await syncFromServer();
    }
  }, [game, user, playerRole, updateGame, syncFromServer]);

  // Auto-skip clue phase if in sudden death OR clue giver has no agents left
  useEffect(() => {
    if (!game || !user || !playerRole || game.status !== 'playing') return;
    if (game.current_phase !== 'clue') return;

    // Only the current clue giver should trigger the skip
    if (game.current_turn !== playerRole) return;

    // Prevent firing multiple times for the same turn/phase
    const skipKey = `${game.current_turn}-${game.current_phase}-${Object.keys(game.board_state.revealed).length}`;
    if (autoSkipKey.current === skipKey) return;

    const inSuddenDeath = game.timer_tokens <= 0 || game.sudden_death;

    // Check if I have any agents left on my key for partner to guess
    const remaining = getRemainingAgentsPerPlayer(game);
    const myRemaining = playerRole === 'player1' ? remaining.player1 : remaining.player2;
    const theirRemaining = playerRole === 'player1' ? remaining.player2 : remaining.player1;

    const otherPlayer = playerRole === 'player1' ? 'player2' : 'player1';

    if (inSuddenDeath) {
      autoSkipKey.current = skipKey;
      // In sudden death, pick the right guesser based on who has agents to find:
      // - If I have agents on my key (myRemaining > 0), the other player should guess my key
      //   → current_turn = me, guesser = otherPlayer
      // - If only they have agents on their key (theirRemaining > 0), I should guess their key
      //   → current_turn = otherPlayer, guesser = me
      if (myRemaining > 0) {
        // Other player guesses my key
        updateGame({ current_turn: playerRole, current_phase: 'guess' });
        supabase
          .from('games')
          .update({ current_turn: playerRole, current_phase: 'guess' })
          .eq('id', game.id)
          .then();
      } else if (theirRemaining > 0) {
        // I guess their key
        updateGame({ current_turn: otherPlayer, current_phase: 'guess' });
        supabase
          .from('games')
          .update({ current_turn: otherPlayer, current_phase: 'guess' })
          .eq('id', game.id)
          .then();
      }
    } else if (myRemaining === 0) {
      autoSkipKey.current = skipKey;
      // I have no agents left - auto-pass to partner to give clue
      updateGame({ current_turn: otherPlayer, current_phase: 'clue' });
      supabase.from('moves').insert({
        game_id: game.id,
        player_id: user.id,
        move_type: 'end_turn',
      }).then(() => {
        supabase
          .from('games')
          .update({ current_turn: otherPlayer, current_phase: 'clue' })
          .eq('id', game.id)
          .then();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, user, playerRole]);

  if (authLoading || loading) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  if (!game || !playerRole) {
    return null;
  }

  // Show review if game is completed
  if (game.status === 'completed') {
    return (
      <GameReview
        game={game}
        moves={moves}
        playerRole={playerRole}
        player1Name={playerRole === 'player1' ? user.username : opponent?.username || 'Player 1'}
        player2Name={playerRole === 'player2' ? user.username : opponent?.username || 'Player 2'}
      />
    );
  }

  const isMyTurn = game.current_turn === playerRole;
  
  // Calculate current clue from moves - only show during guess phase
  const lastClue = moves.filter(m => m.move_type === 'clue').slice(-1)[0] || null;
  const currentClue = game.current_phase === 'guess' ? lastClue : null;
  const hasActiveClue = game.current_phase === 'guess' && lastClue !== null;
  
  // Count guesses this turn (guesses since last clue)
  const lastClueIndex = moves.map(m => m.move_type).lastIndexOf('clue');
  const guessCount = lastClueIndex >= 0 
    ? moves.slice(lastClueIndex + 1).filter(m => m.move_type === 'guess').length 
    : 0;

  return (
    <div className="h-dvh bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col">
      <Header />
      
      <GameStatus
        game={game}
        playerRole={playerRole}
        opponentName={opponent?.username}
        currentClue={currentClue}
        guessCount={guessCount}
        userId={user?.id}
        userName={user?.username}
      />
      
      <main className="flex-1 overflow-auto py-2 px-1 flex flex-col">
        <GameBoard
          game={game}
          playerRole={playerRole}
          onGuess={handleGuess}
          hasActiveClue={hasActiveClue}
        />
        
        {/* Clue input - right below the board (hidden in sudden death) */}
        {isMyTurn && game.current_phase === 'clue' && game.timer_tokens > 0 && !game.sudden_death && (
          <div className="mx-1 mt-2">
            <ClueInput
              game={game}
              playerRole={playerRole}
              onGiveClue={handleGiveClue}
              hasActiveClue={hasActiveClue}
            />
          </div>
        )}
        
        {/* Inline move history - uses remaining space */}
        <div className="flex-1 mt-2 bg-stone-800/50 rounded-lg mx-1 min-h-[100px] max-h-[180px] overflow-y-auto">
          <InlineHistory
            moves={moves}
            playerRole={playerRole}
            player1Name={playerRole === 'player1' ? user.username : opponent?.username || 'Player 1'}
            player2Name={playerRole === 'player2' ? user.username : opponent?.username || 'Player 2'}
            player1Id={game.player1_id}
            player2Id={game.player2_id || ''}
            words={game.words}
          />
        </div>
      </main>
      
      <GameActions
        game={game}
        playerRole={playerRole}
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
