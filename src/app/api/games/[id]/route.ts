import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
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

    // Get the game
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if user is a player
    if (game.player1_id !== user.id && game.player2_id !== user.id) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    // Get all moves for this game
    const { data: moves, error: movesError } = await supabase
      .from('moves')
      .select('*')
      .eq('game_id', id)
      .order('created_at', { ascending: true });

    if (movesError) {
      console.error('Error fetching moves:', movesError);
      return NextResponse.json({ error: 'Failed to fetch moves' }, { status: 500 });
    }

    // Get player usernames
    const playerIds = [game.player1_id, game.player2_id].filter(Boolean);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', playerIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    const usernameMap = new Map(users?.map(u => [u.id, u.username]) ?? []);

    return NextResponse.json({ 
      game,
      moves,
      usernames: Object.fromEntries(usernameMap),
    });
  } catch (error) {
    console.error('Error in GET /api/games/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
