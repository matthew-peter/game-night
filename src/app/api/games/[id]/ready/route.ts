import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { BoardState, CurrentTurn } from '@/lib/supabase/types';

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

    if (game.status !== 'playing') {
      return NextResponse.json(
        { error: 'Game is not in progress' },
        { status: 400 }
      );
    }

    const setup = game.board_state.setup;
    if (!setup || !setup.enabled) {
      return NextResponse.json(
        { error: 'No setup phase for this game' },
        { status: 400 }
      );
    }

    const playerRole: CurrentTurn = isPlayer1 ? 'player1' : 'player2';

    // Mark this player as ready
    const newSetup = { ...setup };
    if (playerRole === 'player1') {
      newSetup.player1Ready = true;
    } else {
      newSetup.player2Ready = true;
    }

    // If both players are now ready, remove the setup phase
    const bothReady = newSetup.player1Ready && newSetup.player2Ready;

    const newBoardState: BoardState = {
      revealed: game.board_state.revealed,
      // If both ready, omit setup entirely — game begins
      ...(bothReady ? {} : { setup: newSetup }),
    };

    const { error: updateError } = await supabase
      .from('games')
      .update({ board_state: newBoardState })
      .eq('id', id);

    if (updateError) {
      console.error('Error marking ready:', updateError);
      return NextResponse.json(
        { error: 'Failed to update ready status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bothReady,
    });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/ready:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
