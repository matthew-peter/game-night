import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { BoardState, Seat } from '@/lib/supabase/types';

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
      board_state: BoardState;
    };

    // Look up seat
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

    if (game.status !== 'playing') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 400 });
    }

    const setup = game.board_state.setup;
    if (!setup || !setup.enabled) {
      return NextResponse.json({ error: 'No setup phase for this game' }, { status: 400 });
    }

    // Mark this seat as ready
    const newReady = [...setup.ready];
    newReady[mySeat] = true;

    // Check if all players are now ready
    const bothReady = newReady.every(Boolean);

    const newBoardState: BoardState = {
      ...game.board_state,
      ...(bothReady
        ? { setup: undefined } // Remove setup — game begins
        : { setup: { ...setup, ready: newReady } }),
    };
    // Clean up undefined key for JSON
    if (bothReady) {
      delete newBoardState.setup;
    }

    const { error: updateError } = await supabase
      .from('games')
      .update({ board_state: newBoardState })
      .eq('id', id);

    if (updateError) {
      console.error('Error marking ready:', updateError);
      return NextResponse.json({ error: 'Failed to update ready status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, bothReady });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/ready:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
