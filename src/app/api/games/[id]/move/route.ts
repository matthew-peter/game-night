import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateClue } from '@/lib/game/clueValidator';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { isWordRevealed, getNextSeat, getRemainingAgentsPerSeat, countTotalAgentsNeeded } from '@/lib/game/gameLogic';
import { BoardState, KeyCard, ClueStrictness, Seat, RevealedCard } from '@/lib/supabase/types';

/**
 * After a move that transitions to 'clue' phase, check if the new clue-giver
 * actually has agents left on their key. If not, auto-skip so the game doesn't
 * get stuck.
 */
function resolveCluePhase(
  updateData: Record<string, unknown>,
  words: string[],
  keyCard: KeyCard,
  boardState: BoardState,
  newClueGiverSeat: Seat,
  inSuddenDeath: boolean,
  playerCount: number = 2
) {
  const tempGame = {
    words,
    key_card: keyCard,
    board_state: boardState,
  } as Parameters<typeof getRemainingAgentsPerSeat>[0];
  const remaining = getRemainingAgentsPerSeat(tempGame);

  const clueGiverRemaining = remaining[newClueGiverSeat] ?? 0;
  const otherSeat = getNextSeat(newClueGiverSeat, playerCount);
  const otherRemaining = remaining[otherSeat] ?? 0;

  if (inSuddenDeath) {
    if (clueGiverRemaining > 0) {
      updateData.current_turn = newClueGiverSeat;
      updateData.current_phase = 'guess';
    } else if (otherRemaining > 0) {
      updateData.current_turn = otherSeat;
      updateData.current_phase = 'guess';
    }
  } else if (clueGiverRemaining === 0) {
    if (otherRemaining > 0) {
      updateData.current_turn = otherSeat;
      updateData.current_phase = 'clue';
      resolveCluePhase(updateData, words, keyCard, boardState, otherSeat, inSuddenDeath, playerCount);
    }
  }
}

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

    // Get the game
    const { data: gameData, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !gameData) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameData as unknown as {
      id: string;
      status: string;
      words: string[];
      key_card: KeyCard;
      board_state: BoardState;
      timer_tokens: number;
      current_turn: Seat;
      current_phase: string;
      current_clue_id: string | null;
      clue_strictness: ClueStrictness;
      sudden_death: boolean;
    };

    if (game.status !== 'playing') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 400 });
    }

    // Look up the user's seat from game_players
    const { data: playerRow } = await supabase
      .from('game_players')
      .select('seat')
      .eq('game_id', id)
      .eq('user_id', user.id)
      .single();

    if (!playerRow) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    const mySeat: Seat = playerRow.seat;
    const currentTurn: Seat = game.current_turn;
    const playerCount = game.key_card.length; // 2 for Codenames Duet

    // Handle different move types
    if (moveType === 'clue') {
      // Clue giver is the player whose turn it is (current_turn seat)
      if (currentTurn !== mySeat) {
        return NextResponse.json({ error: "It's not your turn to give a clue" }, { status: 400 });
      }

      if (game.current_phase !== 'clue') {
        return NextResponse.json({ error: 'Not in clue phase' }, { status: 400 });
      }

      if (game.sudden_death || game.timer_tokens <= 0) {
        return NextResponse.json({ error: 'Cannot give clues in sudden death' }, { status: 400 });
      }

      const visibleWords = game.words.filter(word => !isWordRevealed(word, game.board_state));
      const validation = validateClue(clueWord, visibleWords, game.clue_strictness);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      const { data: moveData, error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: id,
          player_id: user.id,
          move_type: 'clue',
          clue_word: clueWord.toLowerCase(),
          clue_number: intendedWords?.length ?? 0,
          intended_words: intendedWords,
        } as Record<string, unknown>)
        .select('id')
        .single();

      if (moveError || !moveData) {
        console.error('Error creating move:', moveError);
        return NextResponse.json({ error: 'Failed to save move' }, { status: 500 });
      }

      const newTokens = game.timer_tokens - 1;
      const updateData: Record<string, unknown> = {
        current_clue_id: moveData.id,
        current_phase: 'guess',
        timer_tokens: newTokens,
      };

      if (newTokens <= 0) {
        updateData.timer_tokens = 0;
        updateData.sudden_death = true;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true, newTokens });
    }

    if (moveType === 'guess') {
      // Guesser is the OTHER player (not current_turn)
      const guesserSeat = getNextSeat(currentTurn, playerCount);
      if (mySeat !== guesserSeat) {
        return NextResponse.json({ error: "It's not your turn to guess" }, { status: 400 });
      }

      if (game.current_phase !== 'guess') {
        return NextResponse.json({ error: 'Not in guess phase' }, { status: 400 });
      }

      if (guessIndex === undefined || guessIndex < 0 || guessIndex >= 25) {
        return NextResponse.json({ error: 'Invalid guess index' }, { status: 400 });
      }

      const guessedWord = game.words[guessIndex];
      const existingReveal = game.board_state.revealed[guessedWord];

      // Determine card type from the clue giver's perspective
      const cardType = getCardTypeForPlayer(guessIndex, game.key_card, currentTurn);

      if (existingReveal) {
        const isStillAgentToFind = existingReveal.type !== 'agent' && cardType === 'agent';
        if (!isStillAgentToFind) {
          return NextResponse.json({ error: 'Card already revealed' }, { status: 400 });
        }
      }

      const newRevealed: Record<string, RevealedCard> = {
        ...game.board_state.revealed,
        [guessedWord]: {
          type: cardType,
          guessedBy: guesserSeat,
        },
      };

      const newBoardState: BoardState = {
        ...game.board_state,
        revealed: newRevealed,
      };

      const { error: moveError } = await supabase
        .from('moves')
        .insert({
          game_id: id,
          player_id: user.id,
          move_type: 'guess',
          guess_index: guessIndex,
          guess_result: cardType,
          clue_id: game.current_clue_id,
        } as Record<string, unknown>);

      if (moveError) {
        console.error('Error creating move:', moveError);
        return NextResponse.json({ error: 'Failed to save move' }, { status: 500 });
      }

      const updateData: Record<string, unknown> = {
        board_state: newBoardState,
      };

      const assassinHit = cardType === 'assassin';
      const agentsFound = Object.values(newBoardState.revealed).filter(r => r.type === 'agent').length;
      const totalAgentsNeeded = countTotalAgentsNeeded(game.key_card);
      const won = agentsFound >= totalAgentsNeeded;
      const suddenDeath = game.sudden_death || game.timer_tokens <= 0;
      const suddenDeathLoss = suddenDeath && cardType === 'bystander';

      if (assassinHit || suddenDeathLoss) {
        updateData.status = 'completed';
        updateData.result = 'loss';
        updateData.ended_at = new Date().toISOString();
      } else if (won) {
        updateData.status = 'completed';
        updateData.result = 'win';
        updateData.ended_at = new Date().toISOString();
      } else if (cardType !== 'agent') {
        // Wrong guess — switch turns
        const newClueGiverSeat = getNextSeat(currentTurn, playerCount);
        updateData.current_turn = newClueGiverSeat;
        updateData.current_phase = 'clue';
        resolveCluePhase(updateData, game.words, game.key_card, newBoardState, newClueGiverSeat, suddenDeath, playerCount);
      } else if (suddenDeath) {
        // Agent found in sudden death — check if more agents remain on this side
        const currentSideAgents = game.key_card[currentTurn]?.agents ?? [];
        const agentsLeftOnCurrentSide = currentSideAgents.filter(idx => {
          const w = game.words[idx];
          const rev = newBoardState.revealed[w];
          return !rev || rev.type !== 'agent';
        }).length;

        if (agentsLeftOnCurrentSide === 0) {
          updateData.current_turn = getNextSeat(currentTurn, playerCount);
        }
      }

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
      const guesserSeat = getNextSeat(currentTurn, playerCount);
      if (mySeat !== guesserSeat) {
        return NextResponse.json({ error: "It's not your turn" }, { status: 400 });
      }

      if (game.current_phase !== 'guess') {
        return NextResponse.json({ error: 'Not in guess phase' }, { status: 400 });
      }

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

      const inSuddenDeath = game.sudden_death || game.timer_tokens <= 0;

      if (inSuddenDeath) {
        const newTurnSeat = getNextSeat(currentTurn, playerCount);
        const tempGame = game as unknown as Parameters<typeof getRemainingAgentsPerSeat>[0];
        const remaining = getRemainingAgentsPerSeat(tempGame);
        const agentsOnNewSide = remaining[newTurnSeat] ?? 0;

        if (agentsOnNewSide === 0) {
          return NextResponse.json(
            { error: 'Cannot end turn — your partner has no agents left to find' },
            { status: 400 }
          );
        }
      }

      const newClueGiverSeat = getNextSeat(currentTurn, playerCount);
      const updateData: Record<string, unknown> = {
        current_turn: newClueGiverSeat,
        current_phase: inSuddenDeath ? 'guess' : 'clue',
      };

      if (!inSuddenDeath) {
        resolveCluePhase(updateData, game.words, game.key_card, game.board_state, newClueGiverSeat, false, playerCount);
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
