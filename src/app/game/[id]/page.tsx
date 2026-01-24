'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { GameBoard } from '@/components/game/GameBoard';
import { GameStatus } from '@/components/game/GameStatus';
import { ClueInput } from '@/components/game/ClueInput';
import { GameActions } from '@/components/game/GameActions';
import { GameReview } from '@/components/game/GameReview';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { processGuess, getNextTurn } from '@/lib/game/gameLogic';
import { toast } from 'sonner';

function GamePageContent({ gameId }: { gameId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  
  const {
    game,
    setGame,
    updateGame,
    moves,
    setMoves,
    addMove,
    opponent,
    setOpponent,
    clearSelectedWords,
  } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [playerRole, setPlayerRole] = useState<CurrentTurn | null>(null);

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
        }
      )
      .subscribe();

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

    return () => {
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(movesChannel);
    };
  }, [gameId, user, supabase, router, setGame, setMoves, addMove, setOpponent]);

  // Handle giving a clue
  const handleGiveClue = useCallback(async (clue: string, intendedWordIndices: number[]) => {
    if (!game || !user || !playerRole) return;

    const clueNumber = intendedWordIndices.length;

    // Insert move via API or directly
    const { error: moveError } = await supabase.from('moves').insert({
      game_id: game.id,
      player_id: user.id,
      move_type: 'clue',
      clue_word: clue,
      intended_words: intendedWordIndices,
      clue_number: clueNumber,
    });

    if (moveError) {
      toast.error('Failed to give clue');
      return;
    }

    // Update game state - switch turn to the other player (who will guess)
    const nextTurn = playerRole === 'player1' ? 'player2' : 'player1';
    const { error: gameError } = await supabase
      .from('games')
      .update({
        current_phase: 'guess',
        current_turn: nextTurn,
      })
      .eq('id', game.id);

    if (gameError) {
      toast.error('Failed to update game');
      return;
    }

    clearSelectedWords();
    toast.success(`Clue given: ${clue} (${clueNumber})`);
  }, [game, user, playerRole, supabase, clearSelectedWords]);

  // Handle guessing a word
  const handleGuess = useCallback(async (wordIndex: number) => {
    if (!game || !user || !playerRole) return;

    const word = game.words[wordIndex];
    
    // Check if already revealed
    if (game.board_state.revealed[word]) {
      toast.error('This word has already been guessed');
      return;
    }

    // Process the guess
    const result = processGuess(game, wordIndex, playerRole);

    // Insert move
    const { error: moveError } = await supabase.from('moves').insert({
      game_id: game.id,
      player_id: user.id,
      move_type: 'guess',
      guess_index: wordIndex,
      guess_result: result.cardType,
    });

    if (moveError) {
      toast.error('Failed to record guess');
      return;
    }

    // Prepare game updates
    const updates: Record<string, unknown> = {
      board_state: result.newBoardState,
    };

    // Handle game over
    if (result.gameOver) {
      updates.status = 'completed';
      updates.ended_at = new Date().toISOString();
      
      if (result.won) {
        updates.result = 'win';
        toast.success('🎉 You found all the agents!');
      } else if (result.cardType === 'assassin') {
        updates.result = 'loss';
        toast.error('💀 Assassin revealed! Game over.');
      } else {
        updates.result = 'loss';
        toast.error('Time ran out!');
      }
    } else if (result.turnEnds) {
      // Bystander hit, turn ends, lose a token
      const newTokens = game.timer_tokens - 1;
      updates.current_turn = getNextTurn(game.current_turn);
      updates.current_phase = 'clue';
      updates.timer_tokens = newTokens;
      
      if (newTokens <= 0) {
        updates.sudden_death = true;
      }
      
      toast.info('Bystander! Turn over.');
    } else {
      // Correct guess
      toast.success(`✓ ${word} is an agent!`);
    }

    // Update game
    const { error: gameError } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id);

    if (gameError) {
      toast.error('Failed to update game');
    }
  }, [game, user, playerRole, supabase]);

  // Handle ending turn voluntarily
  const handleEndTurn = useCallback(async () => {
    if (!game || !user || !playerRole) return;

    // Create end turn move
    await supabase.from('moves').insert({
      game_id: game.id,
      player_id: user.id,
      move_type: 'end_turn',
    });

    // Update game - end turn consumes a token
    const newTokens = game.timer_tokens - 1;
    const updates: Record<string, unknown> = {
      current_turn: getNextTurn(game.current_turn),
      current_phase: 'clue',
      timer_tokens: newTokens,
    };
    
    if (newTokens <= 0) {
      updates.sudden_death = true;
    }
    
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id);

    if (error) {
      toast.error('Failed to end turn');
    } else {
      toast.info('Turn ended');
    }
  }, [game, user, playerRole, supabase]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
  
  // Calculate current clue from moves
  const currentClue = moves.filter(m => m.move_type === 'clue').slice(-1)[0] || null;
  const hasActiveClue = game.current_phase === 'guess' && currentClue !== null;
  
  // Count guesses this turn (guesses since last clue)
  const lastClueIndex = moves.map(m => m.move_type).lastIndexOf('clue');
  const guessCount = lastClueIndex >= 0 
    ? moves.slice(lastClueIndex + 1).filter(m => m.move_type === 'guess').length 
    : 0;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <GameStatus
        game={game}
        playerRole={playerRole}
        opponentName={opponent?.username}
        currentClue={currentClue}
        guessCount={guessCount}
      />
      
      <main className="flex-1 overflow-auto py-2">
        <GameBoard
          game={game}
          playerRole={playerRole}
          onGuess={handleGuess}
          hasActiveClue={hasActiveClue}
        />
      </main>
      
      <GameActions
        game={game}
        playerRole={playerRole}
        player1Name={playerRole === 'player1' ? user.username : opponent?.username || 'Player 1'}
        player2Name={playerRole === 'player2' ? user.username : opponent?.username || 'Player 2'}
        onEndTurn={handleEndTurn}
        hasActiveClue={hasActiveClue}
        guessCount={guessCount}
      />
      
      {isMyTurn && game.current_phase === 'clue' && (
        <ClueInput
          game={game}
          playerRole={playerRole}
          onGiveClue={handleGiveClue}
          hasActiveClue={hasActiveClue}
        />
      )}
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
