// lib/supabaseAdmin.ts
// Client Supabase con service-role. Da usare SOLO lato server (API routes / server actions).
// IMPORTANTISSIMO: NON deve lanciare errori "a import-time", altrimenti anche build/dev
// può crashare su route non utilizzate.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export const supabaseAdmin: SupabaseClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : missingEnvClient(
        'Supabase Admin non configurato: mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local.'
      );
