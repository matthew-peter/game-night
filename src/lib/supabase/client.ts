import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

// Singleton browser client — avoids recreating on every component render,
// which would cause useEffect dependency churn and subscription teardown/rebuild loops.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
