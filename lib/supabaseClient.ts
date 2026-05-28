import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { missingEnvClient } from '@/lib/supabaseUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  var __tdb_supabase__: SupabaseClient | undefined;
}

export const supabase: SupabaseClient = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return missingEnvClient(
      'Supabase non configurato: mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }

  // In browser: singleton (evita warning e comportamenti strani in dev)
  if (typeof window !== 'undefined') {
    if (!globalThis.__tdb_supabase__) {
      globalThis.__tdb_supabase__ = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }
    return globalThis.__tdb_supabase__;
  }

  // Sul server NON usare questo file. (middleware/route handler usano createServerClient)
  return missingEnvClient(
    'supabaseClient.ts è solo per browser. Sul server usa createServerClient in middleware/route handler.'
  );
})();
