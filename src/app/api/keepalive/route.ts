import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Must not be prerendered or cached — a cached response would never touch the
// database, which is the entire point of this route.
export const dynamic = 'force-dynamic';

/**
 * Keeps the Supabase project from auto-pausing.
 *
 * Supabase pauses free-tier projects after 1 week without activity. When that
 * happens the auth host stops answering and every sign-in fails with an opaque
 * "Failed to fetch" (see PR #1). A single real query per day resets that timer
 * with 6 days to spare.
 *
 * Invoked by the Vercel cron defined in vercel.json. Hobby plans are capped at
 * one run per day with ±59 min precision, which is plenty here.
 */
export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set on
  // the project. If it isn't set the route stays reachable so the cron works
  // out of the box — but set it, so this can't be invoked by anyone who guesses
  // the path. See the PR description.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[keepalive] Supabase env vars missing — cannot ping');
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    // Service role bypasses RLS, so this returns a row rather than being
    // silently filtered to empty — either way it is a real round trip to
    // Postgres, which is what counts as activity.
    const supabase = createClient(url, key);
    const { error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      console.error('[keepalive] query failed:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (err) {
    // A paused or unreachable project lands here rather than returning an error.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[keepalive] unreachable:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
