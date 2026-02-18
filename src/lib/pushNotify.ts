import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails('mailto:gamenight@example.com', pub, priv);
  vapidConfigured = true;
  return true;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Send a push notification to a single user.
 * Fire-and-forget safe — errors are caught and logged.
 */
export async function pushToUser(
  userId: string,
  gameId: string,
  body: string,
  title = 'Game Night'
): Promise<boolean> {
  try {
    if (!ensureVapid()) {
      console.warn('[push] VAPID not configured — skipping');
      return false;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // User has no push subscription — nothing to do
      return false;
    }

    const subscription = JSON.parse(data.subscription);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://game-night-gilt.vercel.app';

    const payload = JSON.stringify({
      title,
      body,
      url: `${appUrl}/game/${gameId}`,
      gameId,
    });

    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (err: unknown) {
    // 410 = subscription expired — clean it up
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
        console.log(`[push] Cleaned up expired subscription for ${userId}`);
      } catch { /* ignore cleanup errors */ }
    } else {
      console.error('[push] Failed to notify user', userId, err);
    }
    return false;
  }
}

/**
 * Send push notifications to multiple users in parallel.
 */
export async function pushToUsers(
  userIds: string[],
  gameId: string,
  body: string,
  title = 'Game Night'
): Promise<void> {
  await Promise.allSettled(
    userIds.map(uid => pushToUser(uid, gameId, body, title))
  );
}

/**
 * Look up usernames for a game's players from the DB.
 * Returns a map of user_id → username.
 */
export async function getPlayerNames(gameId: string): Promise<Map<string, string>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('game_players')
    .select('user_id, user:users!game_players_user_id_fkey(username)')
    .eq('game_id', gameId);

  const map = new Map<string, string>();
  if (data) {
    for (const row of data) {
      const username = (row.user as unknown as { username: string })?.username ?? 'Player';
      map.set(row.user_id, username);
    }
  }
  return map;
}

/**
 * Convenience: after a game move, notify the player(s) whose turn it is next.
 *
 * @param gameId - game id
 * @param actingUserId - the user who just moved
 * @param actingUsername - their display name
 * @param message - notification body text
 * @param recipientUserIds - user IDs to notify (players whose turn is next)
 */
export async function notifyNextPlayers(
  gameId: string,
  actingUserId: string,
  message: string,
  recipientUserIds: string[]
): Promise<void> {
  // Never notify the person who just acted
  const filtered = recipientUserIds.filter(uid => uid !== actingUserId);
  if (filtered.length === 0) return;
  await pushToUsers(filtered, gameId, message);
}
