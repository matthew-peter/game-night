import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getRandomWords } from '@/lib/game/words';
import { generateKeyCard } from '@/lib/game/keyGenerator';
import { generatePin } from '@/lib/utils/pin';
import { ClueStrictness } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const timerTokens = body.timerTokens ?? 9;
    const clueStrictness: ClueStrictness = body.clueStrictness ?? 'strict';

    // Generate game components
    const words = getRandomWords(25);
    const keyCard = generateKeyCard();
    const pin = generatePin();

    // Create the game
    const { data: game, error } = await supabase
      .from('games')
      .insert({
        player1_id: user.id,
        words,
        key_card: keyCard,
        pin,
        timer_tokens: timerTokens,
        clue_strictness: clueStrictness,
        status: 'waiting',
        current_turn: 'player1',
        current_phase: 'clue',
        board_state: {
          revealed: {},
        },
        player1_agents_found: 0,
        player2_agents_found: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Error in POST /api/games:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all games where user is player1 or player2
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error);
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }

    return NextResponse.json({ games });
  } catch (error) {
    console.error('Error in GET /api/games:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
