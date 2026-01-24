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
import { InlineHistory } from '@/components/game/InlineHistory';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { processGuess, getNextTurn } from '@/lib/game/gameLogic';
import { sendTurnNotification } from '@/lib/notifications';
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

    // Subscribe to game changes (UPDATE and DELETE)
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
          console.log('Game update received:', payload);
          console.log('New board_state:', payload.new?.board_state);
          const updatedGame = payload.new as Game;
          setGame(updatedGame);
          
          // If board state changed (someone guessed), the UI will update
          // The game prop flows to GameBoard which reads board_state.revealed
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
        console.log('Game channel status:', status);
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
        async (payload) => {
          const newMove = payload.new as Move;
          addMove(newMove);
          
          // If this is a move from the OTHER player, refetch game to update board
          if (newMove.player_id !== user?.id) {
            const { data: updatedGame } = await supabase
              .from('games')
              .select('*')
              .eq('id', gameId)
              .single();
            
            if (updatedGame) {
              setGame(updatedGame);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Moves channel status:', status);
      });

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

    // Deduct a timer token (each clue = 1 round)
    const newTokens = game.timer_tokens - 1;
    
    const updates: Record<string, unknown> = {
      current_phase: 'guess',
      timer_tokens: newTokens,
      // current_turn stays the same - it represents the clue giver
    };
    
    // Check if out of tokens (sudden death)
    if (newTokens <= 0) {
      updates.timer_tokens = 0;
      updates.sudden_death = true;
    }

    // Update game state
    const { error: gameError } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id);

    if (gameError) {
      toast.error('Failed to update game');
      return;
    }

    // Notify opponent it's their turn to guess
    // The opponent is the guesser (not the clue giver)
    if (opponent) {
      await sendTurnNotification(
        game.id,
        opponent.id,
        user.username,
        `${user.username} gave clue: "${clue.toUpperCase()}" (${clueNumber}) - Your turn to guess!`
      );
    }

    clearSelectedWords();
    toast.success(`Clue given: ${clue} (${clueNumber})`);
  }, [game, user, playerRole, supabase, clearSelectedWords, opponent]);

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
      // Bystander hit, guessing ends, guesser now becomes the clue giver
      // Token already deducted when clue was given
      updates.current_turn = playerRole; // I was guessing, now I give clue
      updates.current_phase = 'clue';
      
      // No notification needed - it's MY turn now to give a clue
      toast.info('Bystander! Your turn to give a clue.');
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
  }, [game, user, playerRole, supabase, opponent]);

  // Handle ending turn voluntarily
  const handleEndTurn = useCallback(async () => {
    if (!game || !user || !playerRole) return;

    // Create end turn move
    await supabase.from('moves').insert({
      game_id: game.id,
      player_id: user.id,
      move_type: 'end_turn',
    });

    // Update game - guesser ends turn, becomes next clue giver
    // Token already deducted when clue was given
    const updates: Record<string, unknown> = {
      current_turn: playerRole, // I was guessing, now I give clue
      current_phase: 'clue',
    };
    
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id);

    if (error) {
      toast.error('Failed to end turn');
    } else {
      // No notification - it's MY turn now to give a clue
      toast.info('Your turn to give a clue!');
    }
  }, [game, user, playerRole, supabase, opponent]);

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
    <div className="min-h-screen bg-gradient-to-b from-stone-800 via-stone-700 to-stone-900 flex flex-col">
      <Header />
      
      <GameStatus
        game={game}
        playerRole={playerRole}
        opponentName={opponent?.username}
        currentClue={currentClue}
        guessCount={guessCount}
      />
      
      <main className="flex-1 overflow-auto py-2 px-1 flex flex-col">
        <GameBoard
          game={game}
          playerRole={playerRole}
          onGuess={handleGuess}
          hasActiveClue={hasActiveClue}
        />
        
        {/* Clue input - right below the board */}
        {isMyTurn && game.current_phase === 'clue' && (
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
        player1Name={playerRole === 'player1' ? user.username : opponent?.username || 'Player 1'}
        player2Name={playerRole === 'player2' ? user.username : opponent?.username || 'Player 2'}
        player1Id={game.player1_id}
        player2Id={game.player2_id || ''}
        onEndTurn={handleEndTurn}
        hasActiveClue={hasActiveClue}
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
