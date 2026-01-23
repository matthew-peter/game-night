import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateClue } from '@/lib/game/clueValidator';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { checkWin, isWordRevealed, getNextTurn } from '@/lib/game/gameLogic';
import { BoardState, KeyCard, ClueStrictness, CurrentTurn, RevealedCard } from '@/lib/supabase/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { moveType, clueWord, intendedWords, guessIndex } = body;

    // Get the game - use type assertion since we know the schema
    const { data: gameData, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !gameData) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Type assertion for game data
    const game = gameData as unknown as {
      id: string;
      status: string;
      player1_id: string;
      player2_id: string | null;
      words: string[];
      key_card: KeyCard;
      board_state: BoardState;
      timer_tokens: number;
      timer_tokens_remaining: number;
      current_turn: CurrentTurn;
      clue_strictness: ClueStrictness;
      current_clue: { word: string; number: number; intendedWords: string[] } | null;
      guesses_this_turn: number;
    };

    // Check if game is in playing status
    if (game.status !== 'playing') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 400 });
    }

    // Determine player role
    const isPlayer1 = game.player1_id === user.id;
    const isPlayer2 = game.player2_id === user.id;
    
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    const playerRole: CurrentTurn = isPlayer1 ? 'player1' : 'player2';
    const currentTurn = game.current_turn;

    // Handle different move types
    if (moveType === 'clue') {
      // Clue giver is the player whose turn it is
      if (currentTurn !== playerRole) {
        return NextResponse.json({ error: "It's not your turn to give a clue" }, { status: 400 });
      }

      // Validate clue
      const visibleWords = game.words.filter(word => !isWordRevealed(word, game.board_state));
      const validation = validateClue(
        clueWord,
        visibleWords,
        game.clue_strictness
      );

      if (!validation.valid) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      // Create the move
      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: id,
          player_id: user.id,
          move_type: 'clue',
          clue_word: clueWord.toLowerCase(),
          clue_number: intendedWords?.length ?? 0,
          intended_words: intendedWords,
        } as Record<string, unknown>);

      if (moveError) {
        console.error('Error creating move:', moveError);
        return NextResponse.json({ error: 'Failed to save move' }, { status: 500 });
      }

      // Update game with current clue
      const { error: updateError } = await supabase
        .from('games')
        .update({
          current_clue: { 
            word: clueWord.toLowerCase(), 
            number: intendedWords?.length ?? 0,
            intendedWords: intendedWords ?? []
          },
          guesses_this_turn: 0,
        } as Record<string, unknown>)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (moveType === 'guess') {
      // Guesser is the OTHER player (not current turn)
      const guesserRole = currentTurn === 'player1' ? 'player2' : 'player1';
      if (playerRole !== guesserRole) {
        return NextResponse.json({ error: "It's not your turn to guess" }, { status: 400 });
      }

      if (guessIndex === undefined || guessIndex < 0 || guessIndex >= 25) {
        return NextResponse.json({ error: 'Invalid guess index' }, { status: 400 });
      }

      const guessedWord = game.words[guessIndex];
      
      if (isWordRevealed(guessedWord, game.board_state)) {
        return NextResponse.json({ error: 'Card already revealed' }, { status: 400 });
      }

      // Determine card type for the clue giver (current turn player)
      const cardType = getCardTypeForPlayer(guessIndex, game.key_card, currentTurn);
      
      // Update board state
      const newRevealed: Record<string, RevealedCard> = {
        ...game.board_state.revealed,
        [guessedWord]: {
          type: cardType,
          guessedBy: guesserRole
        }
      };

      const newBoardState: BoardState = { revealed: newRevealed };

      // Create the guess move
      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: id,
          player_id: user.id,
          move_type: 'guess',
          guessed_word: guessedWord,
          result: cardType,
        } as Record<string, unknown>);

      if (moveError) {
        console.error('Error creating move:', moveError);
        return NextResponse.json({ error: 'Failed to save move' }, { status: 500 });
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        board_state: newBoardState,
        guesses_this_turn: game.guesses_this_turn + 1,
      };

      // Check game end conditions
      const newGame = { 
        ...game, 
        board_state: newBoardState,
        timer_tokens_remaining: game.timer_tokens_remaining
      };
      
      const assassinHit = cardType === 'assassin';
      const won = checkWin(newGame as Parameters<typeof checkWin>[0]);
      const suddenDeath = game.timer_tokens_remaining <= 0;
      const suddenDeathLoss = suddenDeath && cardType === 'bystander';

      if (assassinHit || suddenDeathLoss) {
        // Game over - loss
        updateData.status = 'completed';
        updateData.winner = null;
        updateData.completed_at = new Date().toISOString();
      } else if (won) {
        // Game over - win!
        updateData.status = 'completed';
        updateData.winner = 'both'; // Codenames Duet is cooperative
        updateData.completed_at = new Date().toISOString();
      } else if (cardType !== 'agent') {
        // Wrong guess (bystander) - switch turns
        updateData.timer_tokens_remaining = game.timer_tokens_remaining - 1;
        updateData.current_turn = getNextTurn(currentTurn);
        updateData.current_clue = null;
        updateData.guesses_this_turn = 0;
      }
      // If agent found, continue guessing (don't update turn)

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        cardType,
        gameOver: assassinHit || won || suddenDeathLoss,
        won: won && !assassinHit,
      });
    }

    if (moveType === 'end_turn') {
      // Guesser is the OTHER player
      const guesserRole = currentTurn === 'player1' ? 'player2' : 'player1';
      if (playerRole !== guesserRole) {
        return NextResponse.json({ error: "It's not your turn" }, { status: 400 });
      }

      // Create the end turn move
      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: id,
          player_id: user.id,
          move_type: 'end_turn',
        } as Record<string, unknown>);

      if (moveError) {
        console.error('Error creating move:', moveError);
      }

      const newTokens = game.timer_tokens_remaining - 1;
      
      const updateData: Record<string, unknown> = {
        current_turn: getNextTurn(currentTurn),
        current_clue: null,
        guesses_this_turn: 0,
        timer_tokens_remaining: newTokens,
      };

      // Check if out of tokens (sudden death)
      if (newTokens <= 0) {
        // In sudden death, can still play but any wrong guess loses
        updateData.timer_tokens_remaining = 0;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid move type' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/move:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
