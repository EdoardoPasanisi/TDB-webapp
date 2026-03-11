// FILE: lib/supabaseClient.ts
// Client Supabase SOLO per il browser (Client Components).
// Versione PRO: usa cookie-based session tramite @supabase/ssr,
// così middleware/server possono leggere la sessione.

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function missingEnvClient(message: string): SupabaseClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(message);
      },
    }
  ) as unknown as SupabaseClient;
}

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
