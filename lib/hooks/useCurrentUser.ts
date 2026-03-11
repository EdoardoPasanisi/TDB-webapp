// lib/hooks/useCurrentUser.ts
'use client';

import { useEffect } from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/AuthProvider';

interface UseCurrentUserOptions {
  /**
   * Se impostato, l'utente viene reindirizzato qui se NON è loggato.
   * Esempio tipico: "/login".
   */
  redirectToIfUnauthenticated?: string;

  /**
   * Se impostato, l'utente viene reindirizzato qui se È loggato.
   * Utile per pagine come "/login" o "/signup".
   */
  redirectToIfAuthenticated?: string;

  /**
   * Se true, il redirect viene eseguito solo dopo che il check auth è completato,
   * evitando flicker o redirect multipli in rapida sequenza.
   */
  enableRedirects?: boolean;
}

interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
}

/**
 * Hook centralizzato per ottenere l'utente corrente dal client Supabase.
 *
 * Vantaggi:
 * - legge uno stato auth condiviso (gestito da AuthProvider)
 * - gestione uniforme di loading / error / redirect
 * - opzioni di redirect coerenti in tutta l'app
 *
 * Esempio d'uso in una pagina protetta:
 *
 * const { user, loading } = useCurrentUser({
 *   redirectToIfUnauthenticated: '/login',
 *   enableRedirects: true,
 * });
 */
export function useCurrentUser(
  options: UseCurrentUserOptions = {}
): UseCurrentUserResult {
  const {
    redirectToIfUnauthenticated,
    redirectToIfAuthenticated,
    enableRedirects = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, error } = useAuthContext();

  useEffect(() => {
    if (loading || !enableRedirects) return;

    if (!user && redirectToIfUnauthenticated && pathname !== redirectToIfUnauthenticated) {
      router.replace(redirectToIfUnauthenticated);
      return;
    }

    if (user && redirectToIfAuthenticated && pathname !== redirectToIfAuthenticated) {
      router.replace(redirectToIfAuthenticated);
    }
  }, [
    loading,
    user,
    enableRedirects,
    redirectToIfAuthenticated,
    redirectToIfUnauthenticated,
    pathname,
    router,
  ]);

  return { user, loading, error };
}
