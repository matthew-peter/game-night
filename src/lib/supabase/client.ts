import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

// Singleton browser client — avoids recreating on every component render,
// which would cause useEffect dependency churn and subscription teardown/rebuild loops.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static build/prerender, env vars may not be available.
  // Return a dummy client that will be replaced on hydration in the browser.
  if (!url || !key) {
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  client = createBrowserClient<Database>(url, key);
  return client;
}
