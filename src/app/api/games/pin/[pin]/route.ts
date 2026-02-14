import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find game by PIN — include player count for the caller
    const { data: game, error } = await supabase
      .from('games')
      .select('id, status, game_type, min_players, max_players')
      .eq('pin', pin.toUpperCase())
      .single();

    if (error || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Error in GET /api/games/pin/[pin]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
