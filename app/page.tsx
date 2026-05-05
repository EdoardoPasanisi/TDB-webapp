// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson } from '@/lib/admin/client';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

/**
 * Home "tecnica" dell'app:
 * - se l'utente è loggato → lo manda ai servizi
 * - se non è loggato → lo manda alla pagina di login
 *
 * In futuro potremo trasformare questa pagina in una vera home
 * (feed, notifiche, ecc.) sapendo che la logica di routing è tutta qui.
 */
export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  useEffect(() => {
    if (loading || !user) return;

    let isActive = true;

    fetchAdminJson('/api/admin/me')
      .then(() => {
        if (isActive) router.replace('/admin');
      })
      .catch(() => {
        if (isActive) router.replace('/services');
      });

    return () => {
      isActive = false;
    };
  }, [loading, router, user]);

  // UI minimale di "caricamento" mentre controlliamo lo stato auth
  return (
    <main className="ui-page flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="ui-spinner" />
        <p className="ui-muted">
          Stiamo preparando la tua area personale...
        </p>
      </div>
    </main>
  );
}
