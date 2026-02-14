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

    // Check if user is a player via game_players
    const { data: playerRow } = await supabase
      .from('game_players')
      .select('seat')
      .eq('game_id', id)
      .eq('user_id', user.id)
      .single();

    if (!playerRow) {
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

    // Get player info via game_players + users
    const { data: players } = await supabase
      .from('game_players')
      .select('*, user:users(username)')
      .eq('game_id', id)
      .order('seat', { ascending: true });

    const usernameMap = new Map(
      (players ?? []).map(p => [p.user_id, p.user?.username ?? 'Player'])
    );

    return NextResponse.json({
      game,
      moves,
      players: players ?? [],
      usernames: Object.fromEntries(usernameMap),
    });
  } catch (error) {
    console.error('Error in GET /api/games/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
