import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { BoardState, CurrentTurn, KeyCard } from '@/lib/supabase/types';
import { CODENAMES_WORDS } from '@/lib/game/words';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { wordIndex } = body;

    if (wordIndex === undefined || wordIndex < 0 || wordIndex >= 25) {
      return NextResponse.json(
        { error: 'Invalid word index' },
        { status: 400 }
      );
    }

    // Fetch the game
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
      player1_id: string;
      player2_id: string | null;
      words: string[];
      key_card: KeyCard;
      board_state: BoardState;
    };

    // Must be a player in this game
    const isPlayer1 = game.player1_id === user.id;
    const isPlayer2 = game.player2_id === user.id;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json(
        { error: 'You are not in this game' },
        { status: 403 }
      );
    }

    // Must be in playing status with setup enabled
    if (game.status !== 'playing') {
      return NextResponse.json(
        { error: 'Game is not in progress' },
        { status: 400 }
      );
    }

    const setup = game.board_state.setup;
    if (!setup || !setup.enabled) {
      return NextResponse.json(
        { error: 'Word swaps are not enabled for this game' },
        { status: 400 }
      );
    }

    // Check that both players haven't already confirmed ready
    const playerRole: CurrentTurn = isPlayer1 ? 'player1' : 'player2';
    const myReady =
      playerRole === 'player1' ? setup.player1Ready : setup.player2Ready;
    if (myReady) {
      return NextResponse.json(
        { error: 'You already confirmed ready — cannot swap more words' },
        { status: 400 }
      );
    }

    // Check remaining swaps
    const mySwapsUsed =
      playerRole === 'player1'
        ? setup.player1SwapsUsed
        : setup.player2SwapsUsed;
    if (mySwapsUsed >= setup.maxSwaps) {
      return NextResponse.json(
        { error: 'No swaps remaining' },
        { status: 400 }
      );
    }

    // Pick a random replacement word not already in the game
    const currentWords = new Set(game.words.map((w: string) => w.toUpperCase()));
    const available = CODENAMES_WORDS.filter(
      (w) => !currentWords.has(w.toUpperCase())
    );
    if (available.length === 0) {
      return NextResponse.json(
        { error: 'No replacement words available' },
        { status: 500 }
      );
    }
    const replacement =
      available[Math.floor(Math.random() * available.length)];

    // Build the updated words array
    const newWords = [...game.words];
    newWords[wordIndex] = replacement;

    // Build the updated setup state
    const newSetup = { ...setup };
    if (playerRole === 'player1') {
      newSetup.player1SwapsUsed = mySwapsUsed + 1;
    } else {
      newSetup.player2SwapsUsed = mySwapsUsed + 1;
    }

    const newBoardState: BoardState = {
      ...game.board_state,
      setup: newSetup,
    };

    // Atomic update — the filter ensures we only update if our read was fresh
    const { error: updateError } = await supabase
      .from('games')
      .update({
        words: newWords,
        board_state: newBoardState,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error swapping word:', updateError);
      return NextResponse.json(
        { error: 'Failed to swap word' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      oldWord: game.words[wordIndex],
      newWord: replacement,
      swapsRemaining: setup.maxSwaps - (mySwapsUsed + 1),
    });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/swap-word:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
