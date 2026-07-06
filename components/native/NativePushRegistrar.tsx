'use client';

// Monta la registrazione push iOS quando c'è un utente autenticato.
// Non renderizza nulla. Fuori dall'app iOS (`registerIosPush` fa da guardia) è
// un no-op totale: browser e Android non eseguono alcun codice nativo.

import { useEffect } from 'react';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import { registerIosPush } from '@/lib/native/push';

export function NativePushRegistrar() {
  const { user, loading } = useAuthContext();

  useEffect(() => {
    if (loading || !user) return;
    void registerIosPush(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, [loading, user]);

  return null;
}
