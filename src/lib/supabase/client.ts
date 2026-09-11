import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

// Singleton browser client — avoids recreating on every component render,
// which would cause useEffect dependency churn and subscription teardown/rebuild loops.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ].filter(Boolean).join(', ');

    // In the browser, there is no recovering from this: NEXT_PUBLIC_* values are
    // inlined at build time, so a missing var here means it was missing when the
    // bundle was built. Fail loudly — the previous behaviour was to fall back to
    // a placeholder host that does not resolve, which surfaced to users as an
    // unexplained "Failed to fetch" on every sign-in.
    if (typeof window !== 'undefined') {
      throw new Error(
        `Supabase is not configured: missing ${missing}. ` +
        `These are inlined at build time, so set them in the deployment ` +
        `environment and trigger a new build — changing them without ` +
        `redeploying has no effect.`
      );
    }

    // On the server during static prerender these may legitimately be absent
    // (client components run their render pass at build time). Return an inert
    // client so prerendering completes; the browser path above is the real guard.
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  client = createBrowserClient<Database>(url, key);
  return client;
}
