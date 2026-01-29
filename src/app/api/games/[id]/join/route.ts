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

    // Check if game is in waiting status
    if (game.status !== 'waiting') {
      return NextResponse.json({ error: 'Game is not available to join' }, { status: 400 });
    }

    // Check if user is already player1
    if (game.player1_id === user.id) {
      return NextResponse.json({ error: 'You are already in this game' }, { status: 400 });
    }

    // Check if player2 slot is taken
    if (game.player2_id) {
      return NextResponse.json({ error: 'Game is full' }, { status: 400 });
    }

    // Join the game
    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update({
        player2_id: user.id,
        status: 'playing',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error joining game:', updateError);
      return NextResponse.json({ error: 'Failed to join game' }, { status: 500 });
    }

    // Notify player1 that someone joined
    try {
      // Check env vars
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.log('JOIN NOTIFY: Missing VAPID keys');
      } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('JOIN NOTIFY: Missing SUPABASE_SERVICE_ROLE_KEY');
      } else {
        webpush.setVapidDetails(
          'mailto:codenames@example.com',
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );

        // Use service role key to bypass RLS and read player1's subscription
        const adminSupabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        console.log('JOIN NOTIFY: Looking up subscription for player1:', game.player1_id);
        
        const { data: subData, error: subError } = await adminSupabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', game.player1_id)
          .single();

        if (subError) {
          console.log('JOIN NOTIFY: Subscription lookup error:', subError);
        } else if (!subData) {
          console.log('JOIN NOTIFY: No subscription found for player1');
        } else {
          console.log('JOIN NOTIFY: Found subscription, sending notification');
          const subscription = JSON.parse(subData.subscription);
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const joinerName = user.user_metadata?.username || 'A player';

          const payload = JSON.stringify({
            title: 'Player Joined!',
            body: joinerName + ' joined your game! Lets play!',
            url: appUrl + '/game/' + id,
            gameId: id
          });

          await webpush.sendNotification(subscription, payload);
          console.log('JOIN NOTIFY: Notification sent successfully');
        }
      }
    } catch (notifyError) {
      // Don't fail the join if notification fails
      console.error('JOIN NOTIFY ERROR:', notifyError);
    }

    return NextResponse.json({ game: updatedGame });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/join:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
