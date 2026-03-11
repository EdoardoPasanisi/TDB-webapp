// app/page.tsx
'use client';

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
  useCurrentUser({
    redirectToIfAuthenticated: '/services',
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  // UI minimale di "caricamento" mentre controlliamo lo stato auth
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <p className="text-sm text-slate-300">
          Stiamo preparando la tua area personale...
        </p>
      </div>
    </main>
  );
}
