import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

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

    // Get the game
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status !== 'waiting') {
      return NextResponse.json({ error: 'Game is not available to join' }, { status: 400 });
    }

    // Check if user is already in this game
    const { data: existingPlayer } = await supabase
      .from('game_players')
      .select('seat')
      .eq('game_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingPlayer) {
      return NextResponse.json({ error: 'You are already in this game' }, { status: 400 });
    }

    // Find the next available seat
    const { data: existingPlayers } = await supabase
      .from('game_players')
      .select('seat')
      .eq('game_id', id)
      .order('seat', { ascending: true });

    const takenSeats = new Set((existingPlayers ?? []).map(p => p.seat));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat)) nextSeat++;

    if (nextSeat >= (game.max_players ?? 2)) {
      return NextResponse.json({ error: 'Game is full' }, { status: 400 });
    }

    // Insert into game_players
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_id: id,
        user_id: user.id,
        seat: nextSeat,
      });

    if (joinError) {
      console.error('Error joining game:', joinError);
      return NextResponse.json({ error: 'Failed to join game' }, { status: 500 });
    }

    // Check if the game now has enough players to start
    const currentPlayerCount = takenSeats.size + 1;
    const minPlayers = game.min_players ?? 2;

    if (currentPlayerCount >= minPlayers) {
      const { data: updatedGame, error: updateError } = await supabase
        .from('games')
        .update({ status: 'playing' })
        .eq('id', id)
        .eq('status', 'waiting')  // guard against race
        .select()
        .single();

      if (updateError) {
        console.error('Error starting game:', updateError);
      }
    }

    // Notify existing players that someone joined
    try {
      if (
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        webpush.setVapidDetails(
          'mailto:gamenight@example.com',
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );

        const adminSupabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Notify all OTHER players in the game
        const otherPlayerIds = (existingPlayers ?? [])
          .map(() => null) // We need user_ids, re-fetch with user_id
        ;

        const { data: otherPlayers } = await adminSupabase
          .from('game_players')
          .select('user_id')
          .eq('game_id', id)
          .neq('user_id', user.id);

        for (const otherPlayer of otherPlayers ?? []) {
          const { data: subData } = await adminSupabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', otherPlayer.user_id)
            .single();

          if (subData) {
            const subscription = JSON.parse(subData.subscription);
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const joinerName = user.user_metadata?.username || 'A player';

            const payload = JSON.stringify({
              title: 'Player Joined!',
              body: `${joinerName} joined your game! Let's play!`,
              url: `${appUrl}/game/${id}`,
              gameId: id,
            });

            await webpush.sendNotification(subscription, payload).catch(() => {});
          }
        }
      }
    } catch (notifyError) {
      console.error('JOIN NOTIFY ERROR:', notifyError);
    }

    return NextResponse.json({ success: true, seat: nextSeat });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/join:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
