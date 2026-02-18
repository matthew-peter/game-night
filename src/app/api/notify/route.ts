import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure web-push lazily — VAPID keys may not be set during build
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not set — push notifications disabled');
    return false;
  }
  webpush.setVapidDetails('mailto:gamenight@example.com', publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureVapidConfigured()) {
      return NextResponse.json({ message: 'Push notifications not configured' }, { status: 200 });
    }

    const { gameId, userId, opponentName, message, title } = await request.json();

    if (!gameId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create admin client to access push subscriptions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get the user's push subscription
    const { data: subData, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (error || !subData) {
      return NextResponse.json({ message: 'No subscription found' }, { status: 200 });
    }

    const subscription = JSON.parse(subData.subscription);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://game-night-gilt.vercel.app';

    const payload = JSON.stringify({
      title: title || "It's your turn!",
      body: message || `${opponentName || 'Your opponent'} made a move`,
      url: `${appUrl}/game/${gameId}`,
      gameId: gameId
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Push notification error:', error);
    
    // If subscription is no longer valid, we should clean it up
    if (error instanceof Error && 'statusCode' in error) {
      const webPushError = error as { statusCode: number };
      if (webPushError.statusCode === 410) {
        // Subscription expired - could clean up here
        return NextResponse.json({ message: 'Subscription expired' }, { status: 200 });
      }
    }
    
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
