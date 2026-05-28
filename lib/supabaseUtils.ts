import type { SupabaseClient } from '@supabase/supabase-js';

export function missingEnvClient(message: string): SupabaseClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(message);
      },
    }
  ) as unknown as SupabaseClient;
}
